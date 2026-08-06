import { z, toJSONSchema } from "zod";
import { AgenticToolChunk, OperationChunk, streamEvents, ToolCall, ToolResultComplete } from "../utils/llm-response";
import type { AgentChunk } from "../core/agent";
import { Session } from "../core/session";
import { FilePendingOperation } from "@/type";
import { Tool, ModelMessage } from "ai";
import { AgentStateManager } from "../core/state-manager";
import { withBillingStream } from "@/features/billing/wrapper";
import { createBillableLlmClient, ModelConfig } from "../utils/llm-client";
import { billingService } from "@/features/billing";
import { estimateInputTokens } from "../utils/estimate-token";

export type ToolResult = {
    success: boolean;
    output: string;
    metadata?: Record<string, unknown>;
    operation?: FilePendingOperation[];
}

type AgenticToolResult = AgentChunk | AgenticToolChunk | OperationChunk;

type LlmConfig<T extends z.ZodSchema> = {
    modelId: string;
    modelConfig: ModelConfig;
    buildInput: (data: z.infer<T>) => ModelMessage[];
}

interface BaseToolDefinition<T extends z.ZodSchema> {
    name: string;
    description: string;
    inputSchema: T;
    execute: (input: z.infer<T>, options: {session: Session, state: AgentStateManager, abortSignal: AbortSignal}) => Promise<ToolResult> | AsyncGenerator<AgenticToolResult, void, unknown>;
}

export class BaseTool<T extends z.ZodSchema>{
    public readonly params: BaseToolDefinition<T>;
    constructor(params: BaseToolDefinition<T>){
        this.params = params;
    }

    get schema(): Tool{
        return {
            title: this.params.name,
            description: this.params.description,
            inputSchema: this.params.inputSchema,
        }
    }

    async* execute(toolCall: ToolCall, session: Session, state: AgentStateManager, abortSignal: AbortSignal): AsyncGenerator<ToolResultComplete | AgentChunk | OperationChunk, void, unknown>{
        try {
            const args = this.validateInput(toolCall.input as z.infer<T>);
            const isGenerator = this.params.execute.constructor.name === "AsyncGeneratorFunction";
            const result = await this.params.execute(args, {session, state, abortSignal});
            if(isGenerator){
                for await (const chunk of result as AsyncGenerator<AgenticToolResult, void, unknown>){
                    if(chunk.type === streamEvents.toolResultComplete){
                        yield {
                            type: streamEvents.toolResultComplete,
                            toolName: toolCall.toolName,
                            toolCallId: toolCall.toolCallId,
                            success: chunk.success,
                            output: chunk.output,
                            usage: chunk.usage,
                        };
                    }else{
                        yield chunk;
                    }
                }
                // yield* (result as AsyncGenerator<AgentChunk, void, unknown>);
            } else {
                if('operation' in result && result.operation){
                    const operations = result.operation.map((operation) => ({
                        type: streamEvents.operation,
                        operation,
                    }));
                    for(const operation of operations){
                        yield operation;
                    }
                }
                const event = this.buildEvent(toolCall, result as ToolResult);
                yield event;
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const event = this.buildEvent(toolCall, {
                success: false,
                output: errorMsg,
            });
            yield event;
        }
    }

    validateInput(input: z.infer<T>): z.core.output<T>{
        const validated = this.params.inputSchema.safeParse(input);
        if(!validated.success){
            throw new Error(`Your input is invalid: ${validated.error.message}. The expected input is:\n ${JSON.stringify(toJSONSchema(this.params.inputSchema))}.`);
        }
        return validated.data;
    }

    private buildEvent(toolCall: ToolCall, result: ToolResult): ToolResultComplete{
        return {
            type: streamEvents.toolResultComplete,
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            success: result.success,
            output: result.output,
            usage: {
                input: 0,
                output: 0,
                reasoning: 0,
                cached: 0,
                total: 0,
                cost: 0,
            },
            metadata: result.metadata,
        }
    }
}

type LlmToolParams<T extends z.ZodSchema> = Omit<BaseToolDefinition<T>, 'execute'> & {config: LlmConfig<T>};

export class LlmTool<T extends z.ZodSchema> extends BaseTool<T>{
    private config: LlmConfig<T>;

    constructor(params: LlmToolParams<T>){
        const {config, ...rest} = params;
        super({...rest, execute: async function*(){}});
        this.config = config;
    }
    async* execute(toolCall: ToolCall, session: Session, _state: AgentStateManager, abortSignal: AbortSignal): AsyncGenerator<ToolResultComplete, void, unknown>{
        const result: ToolResultComplete = {
            type: streamEvents.toolResultComplete,
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            success: false,
            output: 'An error occurred while executing the tool',
            usage: {
                input: 0,
                output: 0,
                reasoning: 0,
                cached: 0,
                total: 0,
                cost: 0,
            },
            metadata: {},
        }
        const model = await session.resolveModel(this.config.modelId);
        if(!model){
            throw new Error(`Model ${this.config.modelId} not found in the current session`);
        }
        const billableLlmClient = createBillableLlmClient({
            model,
            modelConfig: this.config.modelConfig,
        });
        const billedLlmStream = withBillingStream(billableLlmClient, billingService)
        const messages = this.config.buildInput(
            this.validateInput(toolCall.input as z.infer<T>)
        )
        const input = {
            messages,
            estimatedInputTokens: estimateInputTokens(messages, 1.15),
            estimatedOutputTokens: this.config.modelConfig.maxOutputTokens || 1500,
        }
        const billedStream = billedLlmStream(input, {
            organizationId: session.organizationId,
            userId: session.userId,
            signal: abortSignal,
            metadata: {
                sessionId: session.id,
                conversationId: session.conversationId,
                runId: session.runId,
            },
        });
        for await (const chunk of billedStream){
            if(chunk.type == 'error'){
                console.error('error', chunk.error)
            }
            if(chunk.type === 'complete'){
                switch(chunk.finishReason){
                    case 'content-filter':
                        result.success = false;
                        result.output = 'Content filter violation stopped the model. The file provided may contain sensitive content.';
                        break;
                    case 'error':
                        result.success = false;
                        result.output = chunk.error || 'An unknown error occurred while executing the tool';
                        break;
                    default:
                        result.success = true;
                        result.output = chunk.text || ''
                }
                result.usage = chunk.usage;
                break;
            }
        }
        yield result;
    }
}

export const buildBaseTool = <T extends z.ZodSchema>(params: BaseToolDefinition<T>): BaseTool<T> => {
    return new BaseTool(params);
}

export const buildLlmTool = <T extends z.ZodSchema>(params: LlmToolParams<T>): LlmTool<T> => {
    return new LlmTool(params);
}