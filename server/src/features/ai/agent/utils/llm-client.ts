import { Output, streamText, generateText, ModelMessage, ToolSet, LanguageModelUsage } from "ai";
import { openai } from "@/lib/llm-providers";
import { z } from "zod";
import { LlmChunk, streamEvents } from "./llm-response";
import { TokenUsage, CompleteReason } from "@/type";

export type ModelConfig = {
    temperature?: number;
    reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
    reasoningSummary?: 'auto' | 'none';
    maxRetries?: number;
    maxOutputTokens?: number;
    timeout?: number;
}

export type InvokeRequest = {
    messages: ModelMessage[];
    abortSignal: AbortSignal;
    outputSchema?: z.ZodSchema;
    stream?: boolean;
}

export class LlmClient {
    private readonly model: string;
    private readonly tools: ToolSet | undefined;
    private readonly modelConfig: ModelConfig | undefined;
    constructor(model: string, modelConfig?: ModelConfig, tools?: ToolSet) {
        this.model = model;
        this.modelConfig = modelConfig;
        this.tools = tools;
    }

    async* invoke(request: InvokeRequest){
        const { messages, abortSignal, outputSchema, stream=true } = request;
        if(stream){
            yield* this.streamResponse({messages, abortSignal, outputSchema});
        } else {
            yield* this.fullResponse({messages, abortSignal, outputSchema});
        }
    }

    private async* fullResponse({messages, abortSignal, outputSchema}: Omit<InvokeRequest, 'stream'>): AsyncGenerator<LlmChunk, void, unknown> {
        const output =
        outputSchema instanceof z.ZodArray
            ? Output.array({ element: outputSchema.element })
            : outputSchema
              ? Output.object({ schema: outputSchema })
              : undefined;

        const modelConfig = this.modelConfig ?? {};

        try {
            const response = await generateText({
                model: openai(this.model),
                messages,
                abortSignal,
                tools: this.tools,
                maxRetries: modelConfig.maxRetries,
                maxOutputTokens: modelConfig.maxOutputTokens,
                output,
                providerOptions: {
                    openai: {
                        reasoningEffort: modelConfig.reasoningEffort,
                        reasoningSummary: modelConfig.reasoningSummary,
                    }
                }
            })
            yield {
                type: streamEvents.complete,
                text: response.text,
                finishReason: response.finishReason,
                usage: this.getTokenUsage(response.usage),
            }
        } catch (error) {
            yield {
                type: streamEvents.complete,
                text: '',
                finishReason: 'error',
                error: error instanceof Error ? error.message : String(error),
                usage: {
                    input: 0,
                    output: 0,
                    reasoning: 0,
                    cached: 0,
                    total: 0,
                    modelId: this.model,
                },

            }
            
        }

    }

    private async* streamResponse({messages, abortSignal, outputSchema}: Omit<InvokeRequest, 'stream'>): AsyncGenerator<LlmChunk, void, unknown> {
        const output =
        outputSchema instanceof z.ZodArray
            ? Output.array({ element: outputSchema.element })
            : outputSchema
              ? Output.object({ schema: outputSchema })
              : undefined;

        const modelConfig = this.modelConfig ?? {};
        let finishReason: CompleteReason = 'other';
        let error: string | undefined;
        let text = '';
        let reasoningText = '';
        let usage: TokenUsage = {
            input: 0,
            output: 0,
            reasoning: 0,
            cached: 0,
            total: 0,
            modelId: this.model,
        };

        try {
            const response = streamText({
                model: openai(this.model),
                messages,
                abortSignal,
                tools: this.tools,
                maxRetries: modelConfig.maxRetries,
                maxOutputTokens: modelConfig.maxOutputTokens,
                output,
                providerOptions: {
                    openai: {
                        reasoningEffort: modelConfig.reasoningEffort,
                        reasoningSummary: modelConfig.reasoningSummary,
                    }
                }
            })
            for await (const chunk of response.fullStream) {
                switch (chunk.type) {
                    case 'text-delta':
                        text += chunk.text;
                        yield {
                            type: streamEvents.textDelta,
                            text: chunk.text,
                        }
                        break;
                    case 'reasoning-delta':{
                        reasoningText += chunk.text;
                        yield {
                            type: streamEvents.reasoningDelta,
                            text: chunk.text,
                        }
                        break;
                    }
                    case 'abort': {
                        if(finishReason !== 'error'){
                            finishReason = 'abort';
                        }
                        break;
                    }
                    case 'error':{
                        error = chunk.error instanceof Error ? chunk.error.message : String(chunk.error);
                        finishReason = 'error';
                        yield {
                            type: streamEvents.error,
                            error,
                        }
                        break;
                    }

                    case 'tool-input-start':{
                        yield {
                            type: streamEvents.toolCallStart,
                            toolCallId: chunk.id,
                            toolName: chunk.toolName,
                            input: '',
                        }
                        break;
                    }

                    case 'tool-input-delta':{
                        yield {
                            type: streamEvents.toolCallDelta,
                            toolCallId: chunk.id,
                            input: chunk.delta,
                        }
                        break;
                    }

                    case 'tool-input-end':{
                        yield {
                            type: streamEvents.toolCallEnd,
                            toolCallId: chunk.id,
                        }
                        break;
                    }

                    case 'tool-call':{
                        yield {
                            type: streamEvents.toolCall,
                            toolCallId: chunk.toolCallId,
                            toolName: chunk.toolName,
                            input: chunk.input as unknown,
                        }
                        break;
                    }

                    default:
                        break;
                }
            }
            usage = this.getTokenUsage(await response.usage);
            finishReason = await response.finishReason;
        } catch (e) {
            error = e instanceof Error ? e.message : String(e)
            finishReason = 'error';
            yield {
                type: streamEvents.error,
                error,
            }
        } finally {
            yield {
                type: streamEvents.complete,
                text,
                finishReason,
                error,
                usage,
                reasoningText
            }
        }
    }

    private getTokenUsage(usage: LanguageModelUsage): TokenUsage {
        return {
            input: usage.inputTokens || 0,
            output: usage.outputTokens || 0,
            reasoning: usage.outputTokenDetails.reasoningTokens || 0,
            cached: (usage.inputTokenDetails.cacheReadTokens || 0) + (usage.inputTokenDetails.cacheWriteTokens || 0),
            total: usage.totalTokens || 0,
            modelId: this.model,
        }
    }
}