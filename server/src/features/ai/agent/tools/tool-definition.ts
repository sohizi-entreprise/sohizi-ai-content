import { z, toJSONSchema } from "zod";
import { AgenticToolChunk, OperationChunk, streamEvents, ToolCall, ToolResultComplete } from "../utils/llm-response";
import { AgentChunk } from "../core/agent";
import { Session } from "../core/session";
import { FilePendingOperation } from "@/type";
import { Tool } from "ai";
import { AgentStateManager } from "../core/state-manager";

export type ToolResult = {
    success: boolean;
    output: string;
    metadata?: Record<string, unknown>;
    operation?: FilePendingOperation[];
}

type AgenticToolResult = AgentChunk | AgenticToolChunk | OperationChunk;

interface BaseToolDefinition<T extends z.ZodSchema> {
    name: string;
    description: string;
    inputSchema: T;
    execute: (input: z.infer<T>, options: {session: Session, state: AgentStateManager}) => Promise<ToolResult> | AsyncGenerator<AgenticToolResult, void, unknown>;
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

    async* execute(toolCall: ToolCall, session: Session, state: AgentStateManager): AsyncGenerator<ToolResultComplete | AgentChunk | OperationChunk, void, unknown>{
        try {
            const args = this.validateInput(toolCall.input as z.infer<T>);
            const isGenerator = this.params.execute.constructor.name === "AsyncGeneratorFunction";
            const result = await this.params.execute(args, {session, state});
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

    private validateInput(input: z.infer<T>): z.core.output<T>{
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
                total: 0
            },
            metadata: result.metadata,
        }
    }
}

export const buildBaseTool = <T extends z.ZodSchema>(params: BaseToolDefinition<T>): BaseTool<T> => {
    return new BaseTool(params);
}

export const buildAgentTool = <T extends z.ZodSchema>(params: BaseToolDefinition<T>): BaseTool<T> => {
    const execute = async function*(args: z.infer<T>){
        // const agent = new Agent();
        // yield* agent.runLoop(userPrompt, new AbortController().signal, 25);
        // const {modelId: _, ...usage} = agent.state.usage!
        // yield {
        //     type: streamEvents.toolResultComplete,
        //     success: agent.state.finishReason === "stop",
        //     output: agent.lastAgentText ?? '',
        //     usage,
        // }

    }
    return new BaseTool({...params, execute});
}