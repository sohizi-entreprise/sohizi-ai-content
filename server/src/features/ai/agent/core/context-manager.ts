import { ModelMessage, UserModelMessage } from "ai";
import { billingService, withBillingStream } from "@/features/billing";
import { BillableLlmInput, createBillableLlmClient, type ModelConfig } from "../utils/llm-client";
import { LlmChunk } from "../utils/llm-response";
import { estimateInputTokens } from "../utils/estimate-token";
import { buildEvaluatorInput, DEFAULT_EVALUATOR_OUTPUT_TOKENS, drainStreamForComplete, parseEvaluatorResponse, StopEvaluation } from "./stop-evaluator";
import { Session } from "./session";
import { AgentStateManager } from "./state-manager";
import { extractTextFromContent } from "../utils/message-content";

export type ContextManagerConfig = {
    maxContextTokens: number;
    session: Session;
    summaryModelId: string;
    evaluatorModelId: string;
    evaluatorModelConfig?: Pick<ModelConfig, 'reasoningEffort'>;
    vendor: string;
    threshold?: number;
    pruneMaxLength?: number;
    keepFirst?: number;
    keepLast?: number;
};

export type ConsumptionInfo = {
    tokens: number;
    max: number;
    percentage: number;
    exceeded: boolean;
};

type SummarizeInput = {
    systemPrompt: string;
    transcript: string;
};

type SummarizeFn = (input: SummarizeInput) => Promise<string>;

type BilledLlmStream = ReturnType<typeof withBillingStream<BillableLlmInput, LlmChunk>>;

const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_PRUNE_MAX_LENGTH = 200;
const DEFAULT_KEEP_FIRST = 5;
const DEFAULT_KEEP_LAST = 10;
const DEFAULT_SUMMARY_OUTPUT_TOKENS = 2048;

const TRUNCATION_MARKER = '...[CONCANATED]';

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer for an autonomous AI agent operating in a tool-calling loop.

You are given a transcript of the middle portion of a conversation (the earliest and most recent messages are kept verbatim elsewhere). Produce a single, clear summary that lets the agent continue its work without losing context or the original goal.

## Requirements
- Preserve the original user goal and how the task evolved (decisions made, what was tried, what worked or failed).
- Keep ALL concrete facts EXACTLY as written: file ids, file paths, URLs, asset ids, todo ids, tool names, and any other identifiers. Never paraphrase or invent identifiers.
- Be concise but complete: capture the important state, not every keystroke.
- Do not add commentary about the summarization itself.

Return only the summary text.`;

export class ContextManager {
    private readonly maxContextTokens: number;
    private readonly threshold: number;
    private readonly pruneMaxLength: number;
    private readonly keepFirst: number;
    private readonly keepLast: number;
    private readonly session: Session;
    private readonly summaryModelId: string;
    private readonly evaluatorModelId: string;
    private readonly evaluatorModelConfig: Pick<ModelConfig, 'reasoningEffort'> | undefined;
    private readonly vendor: string;
    private summaryStream: BilledLlmStream | null | undefined;
    private evaluatorStream: BilledLlmStream | null | undefined;

    constructor(config: ContextManagerConfig) {
        this.maxContextTokens = config.maxContextTokens;
        this.session = config.session;
        this.summaryModelId = config.summaryModelId;
        this.evaluatorModelId = config.evaluatorModelId;
        this.evaluatorModelConfig = config.evaluatorModelConfig;
        this.vendor = config.vendor;
        this.threshold = config.threshold ?? DEFAULT_THRESHOLD;
        this.pruneMaxLength = config.pruneMaxLength ?? DEFAULT_PRUNE_MAX_LENGTH;
        this.keepFirst = config.keepFirst ?? DEFAULT_KEEP_FIRST;
        this.keepLast = config.keepLast ?? DEFAULT_KEEP_LAST;
        this.summaryStream = undefined;
        this.evaluatorStream = undefined;
    }

    /**
     * Entry point called at the end of each agent step. Measures context
     * consumption from the latest LLM call's input tokens and, when the
     * threshold is exceeded, compresses the message history in place. Owns all
     * summary-model wiring so the agent stays lean.
     */
    async maybeCompress(stateManager: AgentStateManager, inputTokens: number, abortSignal: AbortSignal, runId: string): Promise<void> {
        if (stateManager.isExitStatus) {
            return;
        }

        const consumption = this.getConsumption(inputTokens);
        // console.log(`[context] ${consumption.tokens}/${consumption.max} tokens (${(consumption.percentage * 100).toFixed(1)}%)`);
        if (!consumption.exceeded) {
            return;
        }

        const messages = stateManager.getState().messages;
        const summaryStream = await this.getSummaryStream();

        // Fall back to pruning-only when a dedicated summary model is unavailable.
        const compressed = summaryStream
            ? await this.compress(messages, this.buildSummarizeFn(stateManager, summaryStream, abortSignal, runId))
            : this.pruneMessages(messages);

        stateManager.replaceMessages(compressed);
    }

    async evaluateStop(
        stateManager: AgentStateManager,
        userMessage: UserModelMessage,
        lastAssistantText: string,
        abortSignal: AbortSignal,
        runId: string,
    ): Promise<StopEvaluation> {
        try {
            const evaluatorStream = await this.getEvaluatorStream();
            if (!evaluatorStream) {
                return { isDone: true, instruction: '' };
            }

            const evaluatorInput = buildEvaluatorInput({
                userMessage,
                lastAssistantText,
            });
            const billedStream = evaluatorStream(evaluatorInput, {
                organizationId: this.session.organizationId,
                userId: this.session.userId,
                signal: abortSignal,
                metadata: {
                    sessionId: this.session.id,
                    conversationId: this.session.conversationId,
                    runId,
                },
            });

            const result = await drainStreamForComplete(billedStream);
            if (!result) {
                return { isDone: true, instruction: '' };
            }

            stateManager.incrementUsage(result.usage);
            return parseEvaluatorResponse(result.text);
        } catch {
            return { isDone: true, instruction: '' };
        }
    }

    getConsumption(inputTokens: number): ConsumptionInfo {
        const max = this.maxContextTokens > 0 ? this.maxContextTokens : 1;
        const percentage = inputTokens / max;
        return {
            tokens: inputTokens,
            max: this.maxContextTokens,
            percentage,
            exceeded: percentage >= this.threshold,
        };
    }

    /**
     * Strategy 1 — Message pruning.
     * Truncate long tool result payloads to `pruneMaxLength` characters and
     * append a marker so the model knows the content was shortened.
     */
    pruneMessages(messages: ModelMessage[]): ModelMessage[] {
        return messages.map((message) => {
            if (message.role !== 'tool' || !Array.isArray(message.content)) {
                return message;
            }

            const content = message.content.map((part) => {
                if (part.type !== 'tool-result') {
                    return part;
                }
                const output = part.output;
                if (
                    (output.type === 'text' || output.type === 'error-text') &&
                    typeof output.value === 'string' &&
                    output.value.length > this.pruneMaxLength
                ) {
                    return {
                        ...part,
                        output: {
                            ...output,
                            value: output.value.slice(0, this.pruneMaxLength) + TRUNCATION_MARKER,
                        },
                    };
                }
                return part;
            });

            return { ...message, content };
        });
    }

    /**
     * Strategy 2 — Message summarization.
     * Keep the leading system message plus the first `keepFirst` and last
     * `keepLast` non-system messages, condensing everything in between into a
     * single summary produced by `summarizeFn`. Slice boundaries are adjusted
     * so a tool-call is never separated from its tool results.
     */
    async summarizeMessages(messages: ModelMessage[], summarizeFn: SummarizeFn): Promise<ModelMessage[]> {
        const systemMessages = messages.filter((message) => message.role === 'system');
        const conversation = messages.filter((message) => message.role !== 'system');

        // Not enough to summarize — nothing in the middle to condense.
        if (conversation.length <= this.keepFirst + this.keepLast) {
            return messages;
        }

        const firstEnd = this.adjustFirstBoundary(conversation, this.keepFirst);
        const lastStart = this.adjustLastBoundary(conversation, conversation.length - this.keepLast);

        // Boundaries overlapped after adjustment — nothing safe to summarize.
        if (lastStart <= firstEnd) {
            return messages;
        }

        const firstMessages = conversation.slice(0, firstEnd);
        const middleMessages = conversation.slice(firstEnd, lastStart);
        const lastMessages = conversation.slice(lastStart);

        const transcript = this.buildTranscript(middleMessages);
        const summary = await summarizeFn({ systemPrompt: SUMMARY_SYSTEM_PROMPT, transcript });

        const summaryMessage: ModelMessage = {
            role: 'user',
            content: [
                {
                    type: 'text',
                    text: `Summary of the earlier conversation (older messages were condensed to save context):\n\n${summary}`,
                },
            ],
        };

        return [
            ...systemMessages,
            ...firstMessages,
            summaryMessage,
            ...lastMessages,
        ];
    }

    /**
     * Run pruning then summarization, then append the synthetic
     * explain / acknowledge / continue trio so the loop resumes cleanly.
     */
    async compress(messages: ModelMessage[], summarizeFn: SummarizeFn): Promise<ModelMessage[]> {
        const pruned = this.pruneMessages(messages);
        const summarized = await this.summarizeMessages(pruned, summarizeFn);

        const explain: ModelMessage = {
            role: 'user',
            content: [
                { type: 'text', text: 'The earlier messages in this conversation have been summarized to save context.' },
            ],
        };
        const acknowledge: ModelMessage = {
            role: 'assistant',
            content: [
                { type: 'text', text: 'Acknowledged — I have the summarized context and the retained messages.' },
            ],
        };
        const cont: ModelMessage = {
            role: 'user',
            content: [
                { type: 'text', text: 'Please continue with the task.' },
            ],
        };

        return [...summarized, explain, acknowledge, cont];
    }

    /**
     * Extend the first-N boundary forward so it never ends right after an
     * assistant tool-call, splitting it from its tool results.
     */
    private adjustFirstBoundary(conversation: ModelMessage[], boundary: number): number {
        let end = Math.min(boundary, conversation.length);
        while (end < conversation.length && conversation[end].role === 'tool') {
            end++;
        }
        return end;
    }

    /**
     * Move the last-M start backward so it never begins with an orphan tool
     * result whose originating assistant tool-call was summarized away.
     */
    private adjustLastBoundary(conversation: ModelMessage[], boundary: number): number {
        let start = Math.max(boundary, 0);
        while (start > 0 && conversation[start].role === 'tool') {
            start--;
        }
        return start;
    }

    private buildTranscript(messages: ModelMessage[]): string {
        return messages
            .map((message) => {
                switch (message.role) {
                    case 'user':
                        return `[User]\n${this.extractText(message.content)}`;
                    case 'assistant':
                        return `[Assistant]\n${this.extractAssistantText(message.content)}`;
                    case 'tool':
                        return `[Tool Result]\n${this.extractToolText(message.content)}`;
                    default:
                        return `[${message.role}]\n${this.extractText(message.content)}`;
                }
            })
            .join('\n\n');
    }

    private extractText(content: ModelMessage['content']): string {
        return extractTextFromContent(content);
    }

    private extractAssistantText(content: ModelMessage['content']): string {
        if (typeof content === 'string') {
            return content;
        }
        if (!Array.isArray(content)) {
            return JSON.stringify(content);
        }
        return content
            .map((part) => {
                if (part.type === 'text' || part.type === 'reasoning') {
                    return part.text;
                }
                if (part.type === 'tool-call') {
                    return `(tool-call ${part.toolName}: ${JSON.stringify(part.input)})`;
                }
                return JSON.stringify(part);
            })
            .join('\n');
    }

    private extractToolText(content: ModelMessage['content']): string {
        if (typeof content === 'string') {
            return content;
        }
        if (!Array.isArray(content)) {
            return JSON.stringify(content);
        }
        return content
            .map((part) => {
                if (part.type === 'tool-result') {
                    const value = part.output && 'value' in part.output ? part.output.value : part.output;
                    const rendered = typeof value === 'string' ? value : JSON.stringify(value);
                    return `(${part.toolName}) ${rendered}`;
                }
                return JSON.stringify(part);
            })
            .join('\n');
    }

    private buildSummarizeFn(
        stateManager: AgentStateManager,
        summaryStream: BilledLlmStream,
        abortSignal: AbortSignal,
        runId: string,
    ): SummarizeFn {
        return async ({ systemPrompt, transcript }) => {
            const messages: ModelMessage[] = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: [{ type: 'text', text: transcript }] },
            ];
            const input: BillableLlmInput = {
                messages,
                stream: false,
                estimatedInputTokens: estimateInputTokens(messages, 1.15),
                estimatedOutputTokens: DEFAULT_SUMMARY_OUTPUT_TOKENS,
            };
            const stream = summaryStream(input, {
                organizationId: this.session.organizationId,
                userId: this.session.userId,
                signal: abortSignal,
                metadata: {
                    sessionId: this.session.id,
                    conversationId: this.session.conversationId,
                    runId,
                },
            });

            const result = await drainStreamForComplete(stream);
            if (!result) {
                return '';
            }
            stateManager.incrementUsage(result.usage);
            return result.text;
        };
    }

    private async getSummaryStream(): Promise<BilledLlmStream | null> {
        if (this.summaryStream !== undefined) {
            return this.summaryStream;
        }

        const model = await this.session.resolveModel(this.summaryModelId, this.vendor);
        if (!model) {
            this.summaryStream = null;
            return null;
        }

        const summaryClient = createBillableLlmClient({
            model,
            modelConfig: {
                reasoningEffort: 'low',
                maxOutputTokens: DEFAULT_SUMMARY_OUTPUT_TOKENS,
            },
        });
        this.summaryStream = withBillingStream(summaryClient, billingService);
        return this.summaryStream;
    }

    private async getEvaluatorStream(): Promise<BilledLlmStream | null> {
        if (this.evaluatorStream !== undefined) {
            return this.evaluatorStream;
        }

        const model = await this.session.resolveModel(this.evaluatorModelId, this.vendor);
        if (!model) {
            this.evaluatorStream = null;
            return null;
        }

        const evaluatorClient = createBillableLlmClient({
            model,
            modelConfig: {
                reasoningEffort: this.evaluatorModelConfig?.reasoningEffort ?? 'low',
                maxOutputTokens: DEFAULT_EVALUATOR_OUTPUT_TOKENS,
            },
        });
        this.evaluatorStream = withBillingStream(evaluatorClient, billingService);
        return this.evaluatorStream;
    }
}
