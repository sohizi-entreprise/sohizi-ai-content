import { AssistantContent, ModelMessage, ToolModelMessage } from "ai";
import type { BillableLlmClient, BillableLlmInput } from "../utils/llm-client";
import { LlmChunk, streamEvents, ToolCall, ToolResultComplete } from "../utils/llm-response";
import { v4 as uuidv4 } from 'uuid';
import { getTool } from "../tools/tool-registry";
import { mergeGenerators } from "../utils/merge-generators";
import { Session } from "./session";
import { AgentState, CompleteReason, TokenUsage } from "@/type";
import { billingService, withBillingStream } from "@/features/billing";

// Rough chars-per-token heuristic for input estimation when reserving credits.
// Real tokenization is model-specific; this is intentionally conservative.
const CHARS_PER_TOKEN = 4;
const DEFAULT_OUTPUT_TOKEN_ESTIMATE = 4096;


type CallbackEvent = 'finish' | 'start'
type CallbackHandler = (state: AgentState) => void;

export type AgentChunk = {
    name: string;
    runId: string;
} & LlmChunk

export class Agent {
    private readonly billableLlm: BillableLlmClient;
    private readonly billedLlmStream: ReturnType<typeof withBillingStream<BillableLlmInput, LlmChunk>>;
    public state: AgentState;
    private readonly name: string;
    private runId: string | null;
    private callbacks: Map<CallbackEvent, Set<CallbackHandler>>
    private readonly session: Session;

    constructor(name: string, systemPrompt: string, session: Session) {
        this.billableLlm = session.billableLlmClient;
        this.billedLlmStream = withBillingStream(this.billableLlm, billingService);
        this.name = name;
        this.runId = null;
        this.callbacks = new Map();
        this.session = session;
        this.state = this.getInitialState(systemPrompt);
    }

    async* runLoop(prompt: string, abortSignal: AbortSignal, maxSteps: number = 25): AsyncGenerator<AgentChunk, void, unknown> {
        try {
            this.updateStateForStart();
            this.appendUserMessage(prompt);
            this.triggerCallback('start');

            for(let step = 1; step <= maxSteps; step++){
                if(['finished', 'error', 'aborted', 'paused'].includes(this.state.status)){
                    break;
                }
                yield* this.runStep(abortSignal);
                // TODO: Send a final complete event
                // yield {name: this.name, runId: this.runId!, type: streamEvents.complete, usage: this.state.usage!, text: '', finishReason: this.state.finishReason!};
            }
        } catch (error) {
            const errorMessage = this.captureStepError(error);
            yield this.buildErrorEvent(errorMessage);
        } finally {
            try {
                this.triggerCallback('finish');
            } catch (error) {
                console.error('Agent finish callback failed', error);
            }
            await this.session.persistState(this.state);
            yield this.buildUsageEvent();
        }
    }

    async* runStep(abortSignal: AbortSignal): AsyncGenerator<AgentChunk, void, unknown> {
        // Future implementation: context summarization + pruning && user limit checking
        // Future persist messages to the database [checkpoints]
        this.runId = uuidv4();
        const tool_calls: ToolCall[] = [];
        let reasoning_text = '';
        let text = '';
        let stepError: string | null = null;
        let assistantMessageRegistered = false;
        let toolCallsStarted = false;

        const billableInput: BillableLlmInput = {
            messages: this.state.messages,
            estimatedInputTokens: this.estimateInputTokens(this.state.messages),
            estimatedOutputTokens: DEFAULT_OUTPUT_TOKEN_ESTIMATE,
        };

        // `withBillingStream` reserves up-front, settles on the terminal
        // `complete` chunk, and refunds on error / early termination.
        // The agent sees only LLM chunks; billing is invisible to this loop.
        const billedStream = this.billedLlmStream(billableInput, {
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
                        text += chunk.text;
                        yield this.buildEvent(chunk);
                        break;
                    case streamEvents.reasoningDelta:
                        reasoning_text += chunk.text;
                        yield this.buildEvent(chunk);
                        break;
                    case streamEvents.error:
                        stepError = chunk.error;
                        this.captureStepError(chunk.error);
                        yield this.buildEvent(chunk);
                        break;
                    case streamEvents.complete:
                        this.incrementUsage(chunk.usage);
                        this.updateStatus(chunk.finishReason, chunk.error);
                        text = chunk.text || text;
                        reasoning_text = chunk.reasoningText ?? reasoning_text;
                        stepError = chunk.finishReason === 'error' ? chunk.error ?? stepError ?? 'Unknown agent error' : stepError;
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

            if(tool_calls.length > 0 && !stepError && !['error', 'aborted'].includes(this.state.status)){
                toolCallsStarted = true;
                yield* this.runToolCalls(tool_calls);
            }
        } catch (error) {
            stepError = this.captureStepError(error);
            yield this.buildErrorEvent(stepError);
        } finally {
            registerAssistantMessage();
            if(stepError && tool_calls.length > 0 && !toolCallsStarted){
                this.appendToolCallErrors(tool_calls, `Tool call was not executed because the step failed: ${stepError}`);
            }
        }
    }
    
    get lastAgentMessage(): ModelMessage | null {
        const lastMessage = this.state.messages[this.state.messages.length - 1];
        if(lastMessage.role === 'assistant'){
            return lastMessage;
        }
        return null;
    }

    get lastAgentText(): string | null {
        const lastMessage = this.lastAgentMessage;
        if(!lastMessage){
            return null
        }
        if(typeof lastMessage.content === 'string'){
            return lastMessage.content;
        }
        const text = lastMessage.content.filter((content) => content.type === 'text').map((content) => content.text).join('\n');
        return text;
    }

    private updateStatus(finishReason: CompleteReason, error?: string) {
        this.state.finishReason = finishReason;
        switch (finishReason) {
            case 'abort':
                this.state.status = 'aborted';
                break;
            case 'error':
                this.state.status = 'error';
                this.state.error = error ?? 'Unknown agent error';
                break;
            case 'tool-calls':
                break;
            default:
                this.state.status = 'finished';
                break;
        }
    }

    private updateStateForStart(){
        this.state.status = 'running';
        this.state.error = null;
    }

    private getInitialState(systemPrompt: string): AgentState {
        const existingState = this.session.checkpoint.state;
        if(existingState){
            const messages = existingState.messages.filter((message) => message.role !== 'system');
            return {...existingState, status: 'idle', messages: [{role: 'system', content: systemPrompt}, ...messages]};
        }
        return {
            messages: [{
                role: 'system',
                content: systemPrompt,
            }],
            usage: null,
            finishReason: null,
            error: null,
            status: 'idle',
            todos: [],
        }
    }

    private appendUserMessage(message: string) {
        this.registerMessage({
            role: 'user',
            content: [{type: 'text', text: message}],
        });
    }

    private incrementUsage(usage: TokenUsage) {
        if(!this.state.usage){
            this.state.usage = usage;
            return;
        }
        this.state.usage = {
            ...this.state.usage,
            input: this.state.usage.input + usage.input || 0,
            output: this.state.usage.output + usage.output || 0,
            reasoning: this.state.usage.reasoning + usage.reasoning || 0,
            cached: this.state.usage.cached + usage.cached || 0,
            total: this.state.usage.total + usage.total || 0,
        }
    }

    private async* runToolCalls(tool_calls: ToolCall[]): AsyncGenerator<AgentChunk, void, unknown> {
        const generators: AsyncGenerator<ToolResultComplete | AgentChunk, void, unknown>[] = [];
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
            generators.push(tool.execute(tool_call, this.session, this.state));
        }

        if(invalidTools.length > 0){
            this.appendBadToolNames(invalidTools);
        }

        try {
            for await (const chunk of mergeGenerators(...generators)){
                if(chunk.type === streamEvents.toolResultComplete){
                    completedToolCallIds.add(chunk.toolCallId);
                    this.updateToolResults(chunk);
                }else{
                    yield chunk;
                }
            }
        } catch (error) {
            const errorMessage = this.errorToMessage(error);
            const incompleteToolCalls = validToolCalls.filter((toolCall) => !completedToolCallIds.has(toolCall.toolCallId));
            this.appendToolCallErrors(incompleteToolCalls, errorMessage);
            throw error;
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
        if(error instanceof Error && error.name === 'AbortError'){
            this.state.status = 'aborted';
            this.state.finishReason = 'abort';
        }else{
            this.state.status = 'error';
            this.state.finishReason = 'error';
        }
        this.state.error = message;
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
        this.incrementUsage({...result.usage, modelId: this.session.model.id});
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

    private registerMessage(message: ModelMessage | ModelMessage[]) {
        if(Array.isArray(message)){
            this.state.messages.push(...message);
        }else{
            this.state.messages.push(message);
        }
        this.session.registerMessage(message);
    }

    private buildEvent(chunk: LlmChunk): AgentChunk {
        return {
            name: this.name,
            runId: this.ensureRunId(),
            ...chunk,
        }
    }

    private buildErrorEvent(error: string): AgentChunk {
        return this.buildEvent({
            type: streamEvents.error,
            error,
        });
    }

    private buildUsageEvent(): AgentChunk {
        return this.buildEvent({
            type: streamEvents.usage,
            usage: this.state.usage ?? this.emptyUsage(),
        });
    }

    private emptyUsage(): TokenUsage {
        return {
            input: 0,
            output: 0,
            reasoning: 0,
            cached: 0,
            total: 0,
            modelId: this.session.model.id,
        };
    }

    private ensureRunId(): string {
        if(!this.runId){
            this.runId = uuidv4();
        }
        return this.runId;
    }

    registerCallback(event: CallbackEvent, handler: CallbackHandler) {
        if(!this.callbacks.has(event)){
            this.callbacks.set(event, new Set());
        }
        this.callbacks.get(event)?.add(handler);
    }

    unregisterCallback(event: CallbackEvent, handler: CallbackHandler) {
        this.callbacks.get(event)?.delete(handler);
    }

    private triggerCallback(event: CallbackEvent) {
        this.callbacks.get(event)?.forEach(handler => handler(this.state));
    }

    private estimateInputTokens(messages: ModelMessage[]): number {
        const chars = JSON.stringify(messages).length;
        return Math.max(1, Math.ceil(chars / CHARS_PER_TOKEN));
    }
}