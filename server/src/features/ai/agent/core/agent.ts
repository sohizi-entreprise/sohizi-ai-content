import { AssistantContent, ModelMessage, ToolModelMessage, UserModelMessage } from "ai";
import { createBillableLlmClient, type BillableLlmClient, type BillableLlmInput, type ModelConfig } from "../utils/llm-client";
import type { ResolvedVendorModel } from "@/features/models/repo";
import { LlmChunk, OperationChunk, streamEvents, ToolCall, ToolResultComplete } from "../utils/llm-response";
import { v4 as uuidv4 } from 'uuid';
import { getTool } from "../tools/tool-registry";
import { mergeGenerators } from "../utils/merge-generators";
import { Session } from "./session";
import { AgentState, CompleteReason, TokenUsage } from "@/type";
import { billingService, withBillingStream } from "@/features/billing";
import { AgentStateManager } from "./state-manager";
import { Persistence } from "./persistence";
import { estimateInputTokens } from "../utils/estimate-token";
import { ContextManager } from "./context-manager";


const DEFAULT_OUTPUT_TOKEN_ESTIMATE = 4096;

export type AgentChunk = {
    name: string;
    runId: string;
} & (LlmChunk | ToolResultComplete | OperationChunk)

type AgentConfig = {
    model: ResolvedVendorModel;
    vendor: string;
    modelConfig: ModelConfig;
    session: Session;
    name: string;
    systemPrompt: string;
    persistence?: Persistence;
    maxContextTokens: number;
    contextThreshold?: number;
    summaryModelId: string;
    evaluatorModelId: string;
    evaluatorModelConfig?: Pick<ModelConfig, 'reasoningEffort'>;
}

type BilledLlmStream = ReturnType<typeof withBillingStream<BillableLlmInput, LlmChunk>>;



export class Agent {
    public stateManager: AgentStateManager;
    private readonly name: string;
    private runId: string | null;
    private readonly session: Session;
    private readonly persistence: Persistence | undefined;
    private readonly agentParams: Pick<AgentConfig, 'name' | 'systemPrompt'>;
    private readonly modelConfig: ModelConfig;
    private readonly model: ResolvedVendorModel;
    private readonly contextManager: ContextManager;
    private lastInputTokens: number;
    private userMessage: UserModelMessage | null;

    constructor(config: AgentConfig) {
        this.name = config.name;
        this.runId = null;
        this.session = config.session;
        this.stateManager = new AgentStateManager();
        this.persistence = config.persistence;
        this.agentParams = {
            name: config.name,
            systemPrompt: config.systemPrompt
        };
        this.modelConfig = config.modelConfig;
        this.model = config.model;
        this.lastInputTokens = 0;
        this.userMessage = null;
        this.contextManager = new ContextManager({
            maxContextTokens: config.maxContextTokens,
            threshold: config.contextThreshold,
            session: config.session,
            summaryModelId: config.summaryModelId,
            evaluatorModelId: config.evaluatorModelId,
            evaluatorModelConfig: config.evaluatorModelConfig,
            vendor: config.vendor,
        });
    }

    async* runLoop(ursMsg: UserModelMessage, abortSignal: AbortSignal, maxSteps: number = 25): AsyncGenerator<AgentChunk, void, unknown> {
        try {
            const billableLlmClient = await this.buildBillableLlmClient();
            const billedLlmStream = withBillingStream(billableLlmClient, billingService);

            this.userMessage = ursMsg;
            this.initializeState(this.agentParams.systemPrompt);
            this.registerMessage(ursMsg);

            let stepsRun = 0;
            for(let step = 1; step <= maxSteps; step++){
                if(this.stateManager.isExitStatus){
                    break;
                }
                yield* this.runStep(billedLlmStream, abortSignal, step);
                await this.contextManager.maybeCompress(this.stateManager, this.lastInputTokens, abortSignal, this.ensureRunId());
                stepsRun++;
            }

            if(this.stateManager.isRunning){
                this.stateManager.finishRun();
            }
        } catch (error) {
            console.log('runLoop error', error);
            const errorMessage = this.captureStepError(error);
            yield this.buildErrorEvent(errorMessage);
        } finally {
            // Persist optionally based on the agent config
            await this.persistence?.persist(this.stateManager.getState());
            yield this.buildUsageEvent();
        }
    }

    async* runStep(callClient: BilledLlmStream, abortSignal: AbortSignal, _step: number): AsyncGenerator<AgentChunk, void, unknown> {
        // Future implementation: context summarization + pruning && user limit checking
        // Future persist messages to the database [checkpoints]
        this.runId = uuidv4();
        const tool_calls: ToolCall[] = [];
        let reasoning_text = '';
        let text = '';
        let stepError: string | null = null;
        let assistantMessageRegistered = false;
        let toolCallsStarted = false;

        const stateMessages = this.stateManager.getState().messages;

        const billableInput: BillableLlmInput = {
            messages: stateMessages,
            estimatedInputTokens: estimateInputTokens(stateMessages, 1.15),
            estimatedOutputTokens: DEFAULT_OUTPUT_TOKEN_ESTIMATE,
        };

        // `withBillingStream` reserves up-front, settles on the terminal
        // `complete` chunk, and refunds on error / early termination.
        // The agent sees only LLM chunks; billing is invisible to this loop.
        const billedStream = callClient(billableInput, {
            organizationId: this.session.organizationId,
            userId: this.session.userId,
            signal: abortSignal,
            metadata: {
                sessionId: this.session.id,
                conversationId: this.session.conversationId,
                runId: this.runId,
            },
        });

        const registerAssistantMessage = () => {
            if(assistantMessageRegistered) return;

            const content = this.buildAssistantContent(reasoning_text, text, tool_calls, stepError);
            if(content.length > 0){
                this.registerMessage({
                    role: 'assistant',
                    content,
                });
            }
            assistantMessageRegistered = true;
        };

        try {
            for await (const chunk of billedStream) {
                switch (chunk.type) {
                    case streamEvents.textDelta:
                        text = chunk.text;
                        yield this.buildEvent(chunk);
                        break;
                    case streamEvents.reasoningDelta:
                        reasoning_text = chunk.text;
                        yield this.buildEvent(chunk);
                        break;
                    case streamEvents.error:
                        yield this.buildEvent(chunk);
                        break;
                    case streamEvents.complete:
                        this.stateManager.incrementUsage(chunk.usage);
                        this.lastInputTokens = chunk.usage.input || this.lastInputTokens;
                        this.updateStatus(chunk.finishReason, chunk.error);
                        text = chunk.text || text;
                        reasoning_text = chunk.reasoningText ?? reasoning_text;
                        if(chunk.finishReason === 'error'){
                            stepError = chunk.error ?? 'Unknown agent error';
                            console.log('stepError', stepError);
                            this.captureStepError(stepError);
                        }
                        break;
                    case streamEvents.toolCall:
                        tool_calls.push(chunk);
                        yield this.buildEvent(chunk);
                        break;
                    default:
                        yield this.buildEvent(chunk);
                }
            }

            registerAssistantMessage();

            if(tool_calls.length > 0 && !stepError){
                toolCallsStarted = true;
                yield* this.runToolCalls(tool_calls, abortSignal);
            }

            if (tool_calls.length === 0 && !stepError && !this.stateManager.isExitStatus && this.userMessage) {
                const evaluation = await this.contextManager.evaluateStop(
                    this.stateManager,
                    this.userMessage,
                    text,
                    abortSignal,
                    this.ensureRunId(),
                );
                if (evaluation.isDone) {
                    this.stateManager.finishRun();
                } else {
                    console.log('evaluation', evaluation);
                    this.registerMessage({
                        role: 'user',
                        content: [{ type: 'text', text: evaluation.instruction }],
                    }, true);
                }
            }
        } catch (error) {
            console.log('runStep error', error);
            stepError = this.captureStepError(error);
            yield this.buildErrorEvent(stepError);
        } finally {
            registerAssistantMessage();
            if(stepError && tool_calls.length > 0 && !toolCallsStarted){
                this.appendToolCallErrors(tool_calls, `Tool call was not executed because the step failed: ${stepError}`);
            }
        }
    }

    private updateStatus(finishReason: CompleteReason, error?: string) {
        this.stateManager.setFinishReason(finishReason);
        switch (finishReason) {
            case 'abort':
                this.stateManager.finishRun();
                break;
            case 'error':
                this.stateManager.setError(error ?? 'Unknown agent error');
                break;
            
            
            default:
                // Stay running until finalizeStepStatus — a turn may include tool calls
                // even when finishReason is not exactly 'tool-calls'.
                break;
        }
    }

    private initializeState(systemPrompt: string) {
        const existingState = this.persistence?.getInitialState();
        let state: AgentState = {
            messages: [{ role: 'system', content: systemPrompt }],
            finishReason: null,
            error: null,
            status: 'idle',
            todos: [],
            usage: null,
        };
        if(existingState){
            const messages = existingState.messages.filter((message) => message.role !== 'system');
            state = {...existingState, status: 'idle', messages: [{role: 'system', content: systemPrompt}, ...messages]};
        }

        this.stateManager.setState(state);
        this.stateManager.startRun()
    }

    private async* runToolCalls(tool_calls: ToolCall[], abortSignal: AbortSignal): AsyncGenerator<AgentChunk, void, unknown> {
        const generators: AsyncGenerator<ToolResultComplete | AgentChunk | OperationChunk, void, unknown>[] = [];
        const invalidTools: {toolCallId: string, toolName: string}[] = [];
        const validToolCalls: ToolCall[] = [];
        const completedToolCallIds = new Set<string>();
        for(const tool_call of tool_calls){
            const tool = getTool(tool_call.toolName);
            if(!tool){
                invalidTools.push({toolCallId: tool_call.toolCallId, toolName: tool_call.toolName});
                continue;
            }
            validToolCalls.push(tool_call);
            generators.push(tool.execute(tool_call, this.session, this.stateManager, abortSignal));
        }

        if(invalidTools.length > 0){
            this.appendBadToolNames(invalidTools);
        }

        try {
            for await (const chunk of mergeGenerators(...generators)){
                if(chunk.type === streamEvents.toolResultComplete){
                    completedToolCallIds.add(chunk.toolCallId);
                    this.updateToolResults(chunk);
                }
                yield this.buildEvent(chunk);
            }
        } catch (error) {
            const errorMessage = this.errorToMessage(error);
            const incompleteToolCalls = validToolCalls.filter((toolCall) => !completedToolCallIds.has(toolCall.toolCallId));
            this.appendToolCallErrors(incompleteToolCalls, errorMessage);
            // throw error;
        }
    }

    private buildAssistantContent(reasoningText: string, text: string, toolCalls: ToolCall[], stepError: string | null): AssistantContent {
        const content: AssistantContent = [];
        if(reasoningText){
            content.push({type: 'reasoning', text: reasoningText});
        }
        if(text){
            content.push({type: 'text', text});
        }
        if(stepError){
            content.push({type: 'text', text: `Step failed: ${stepError}`});
        }
        for(const tool_call of toolCalls){
            content.push({type: 'tool-call', toolName: tool_call.toolName, input: tool_call.input, toolCallId: tool_call.toolCallId});
        }
        return content;
    }

    private captureStepError(error: unknown): string {
        const message = this.errorToMessage(error);
        let isAborted = false;
        if(error instanceof Error && error.name === 'AbortError'){
            isAborted = true;
        }
        this.stateManager.setError(message);
        this.stateManager.setFinishReason(isAborted ? 'abort' : 'error');

        return message;
    }

    private errorToMessage(error: unknown): string {
        if(error instanceof Error){
            return error.message;
        }
        return String(error);
    }

    private appendToolCallErrors(toolCalls: ToolCall[], errorMessage: string) {
        if(toolCalls.length === 0) return;

        const msgs: ToolModelMessage[] = toolCalls.map((toolCall) => ({
            role: 'tool',
            content: [
                {
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    output: {
                        type: 'error-text',
                        value: errorMessage,
                    },
                },
            ],
        }));
        this.registerMessage(msgs);
    }

    private updateToolResults(result: ToolResultComplete) {
        const msg: ToolModelMessage = {
            role: 'tool',
            content: [
                {
                    type: 'tool-result',
                    toolCallId: result.toolCallId,
                    toolName: result.toolName,
                    output: {
                        type: result.success ? 'text' : 'error-text',
                        value: result.output,
                    },
                },
            ],
        };

        this.registerMessage(msg);
        this.stateManager.incrementUsage({...result.usage, modelId: this.model.id});
    }

    private appendBadToolNames(data: {toolCallId: string, toolName: string}[]){
        const msgs: ToolModelMessage[] = data.map((item) => ({
            role: 'tool',
            content: [
                {
                    type: 'tool-result',
                    toolCallId: item.toolCallId,
                    toolName: item.toolName,
                    output: {
                        type: 'error-text',
                        value: `Invalid tool name: ${item.toolName}`,
                    },
                },
            ],
        }));
        this.registerMessage(msgs);
    }

    private registerMessage(message: ModelMessage | ModelMessage[], stateOnly: boolean = false) {
        const messages = Array.isArray(message) ? message : [message];
        this.stateManager.appendMessages(messages);
        if(!stateOnly){
            this.persistence?.registerMessage(messages);
        }
    }

    private buildEvent(chunk: LlmChunk | ToolResultComplete | OperationChunk | AgentChunk): AgentChunk {
        return {
            ...chunk,
            name: this.name,
            runId: this.ensureRunId(),
        }
    }

    private buildErrorEvent(error: string): AgentChunk {
        return this.buildEvent({
            type: streamEvents.error,
            error,
        });
    }

    private buildUsageEvent(): AgentChunk {
        const usage = this.stateManager.getState().usage;
        return this.buildEvent({
            type: streamEvents.usage,
            usage: usage ?? this.emptyUsage(),
        });
    }

    private emptyUsage(): TokenUsage {
        return {
            input: 0,
            output: 0,
            reasoning: 0,
            cached: 0,
            total: 0,
            modelId: this.model.id,
            cost: 0,
        };
    }

    private ensureRunId(): string {
        if(!this.runId){
            this.runId = uuidv4();
        }
        return this.runId;
    }

    async buildBillableLlmClient(): Promise<BillableLlmClient> {
        return createBillableLlmClient({
            model: this.model,
            modelConfig: this.modelConfig,
        });
    }
}