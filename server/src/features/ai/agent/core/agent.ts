import { ModelMessage, ToolModelMessage } from "ai";
import { InvokeRequest, LlmClient } from "../utils/llm-client";
import { CompleteReason, LlmChunk, streamEvents, TokenUsage, ToolCall, ToolResultComplete } from "../utils/llm-response";
import { v4 as uuidv4 } from 'uuid';
import { getTool } from "../tools/tool-registry";
import { mergeGenerators } from "../utils/merge-generators";
import { Session } from "./session";

type Runstatus = 'idle' | 'running' | 'finished' | 'error' | 'aborted' | 'paused'

type TodoItem = {
    id: string;
    task: string;
    status: 'pending' | 'in_progress' | 'done';
}

export type AgentState = {
    messages: ModelMessage[];
    usage: TokenUsage | null;
    status: Runstatus;
    finishReason: CompleteReason | 'need-approval' | null;
    error: string | null;
    todos: TodoItem[];
}

type CallbackEvent = 'finish' | 'start'
type CallbackHandler = (state: AgentState) => void;

export type AgentChunk = {
    name: string;
    runId: string;
} & LlmChunk

export class Agent {
    private readonly llmClient: LlmClient;
    public state: AgentState;
    private readonly systemPrompt: string;
    private readonly name: string;
    private runId: string | null;
    private callbacks: Map<CallbackEvent, Set<CallbackHandler>>
    private readonly session: Session;

    constructor(name: string, llmClient: LlmClient, systemPrompt: string, session: Session) {
        this.llmClient = llmClient;
        this.state = this.getInitialState();
        this.systemPrompt = systemPrompt;
        this.name = name;
        this.runId = null;
        this.callbacks = new Map();
        this.session = session;
    }

    async* runLoop(prompt: string, abortSignal: AbortSignal, maxSteps: number = 25): AsyncGenerator<AgentChunk, void, unknown> {
        this.triggerCallback('start');
        this.state.status = 'running';
        this.appendUserMessage(prompt);
        for(let step = 1; step <= maxSteps; step++){
            if(['finished', 'error', 'aborted', 'paused'].includes(this.state.status)){
                break;
            }
            yield* this.runStep(abortSignal);
        }
        this.triggerCallback('finish');
    }

    async* runStep(abortSignal: AbortSignal): AsyncGenerator<AgentChunk, void, unknown> {
        // Get the messages context [system, user]
        // If there are tool calls, we run them and return the results
        // We need to update the state at the end of the run
        // Future implementation: context summarization + pruning && user limit checking
        // Future persist messages to the database [checkpoints]
        const request: InvokeRequest = {
            messages: this.state.messages,
            abortSignal,
        }
        this.runId = uuidv4();
        const tool_calls: ToolCall[] = [];
        let reasoning_text = '';
        let text = '';

        for await (const chunk of this.llmClient.invoke(request)) {
            switch (chunk.type) {
                case streamEvents.complete:
                    this.incrementUsage(chunk.usage);
                    this.updateStatus(chunk.finishReason, chunk.error);
                    text = chunk.text;
                    reasoning_text = chunk.reasoningText ?? '';
                    break;
                case streamEvents.toolCall:
                    tool_calls.push(chunk);
                    yield this.buildEvent(chunk);
                    break;
                default:
                    yield this.buildEvent(chunk);
            }
        }

        const assistant_message: ModelMessage = {
            role: 'assistant',
            content: [
                {
                    type: 'text',
                    text,
                },
                {
                    type: 'reasoning',
                    text: reasoning_text,
                },
                ...tool_calls.map((tool_call) => ({
                    type: 'tool-call' as const,
                    toolName: tool_call.toolName,
                    input: tool_call.input,
                    toolCallId: tool_call.toolCallId,
                })),
            ],
        }

        if(text || tool_calls.length > 0){
            this.state.messages.push(assistant_message);
        }

        if(tool_calls.length > 0){
            yield* this.runToolCalls(tool_calls);
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
                this.state.error = error ?? null;
                break;
            default:
                this.state.status = 'finished';
                break;
        }
    }

    private getInitialState(): AgentState {
        return {
            messages: [{
                role: 'system',
                content: this.systemPrompt,
            }],
            usage: null,
            finishReason: null,
            error: null,
            status: 'idle',
            todos: [],
        }
    }

    private appendUserMessage(message: string) {
        this.state.messages.push({
            role: 'user',
            content: message,
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
        for(const tool_call of tool_calls){
            const tool = getTool(tool_call.toolName);
            if(!tool){
                invalidTools.push({toolCallId: tool_call.toolCallId, toolName: tool_call.toolName});
                continue;
            }
            generators.push(tool.execute(tool_call, this.session, this.state));
        }

        if(invalidTools.length > 0){
            this.appendBadToolNames(invalidTools);
        }

        for await (const chunk of mergeGenerators(...generators)){
            if(chunk.type === streamEvents.toolResultComplete){
                this.updateToolResults(chunk);
            }else{
                yield chunk;
            }
        }
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

        this.state.messages.push(msg);
        this.incrementUsage({...result.usage, modelId: this.session.modelConfig.modelId});
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
        this.state.messages.push(...msgs);
    }

    private buildEvent(chunk: LlmChunk): AgentChunk {
        return {
            name: this.name,
            runId: this.runId!,
            ...chunk,
        }
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
}