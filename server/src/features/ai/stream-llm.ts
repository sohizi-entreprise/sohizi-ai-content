import { Output, streamText } from "ai";
import { openai } from "@/lib/llm-providers";
import { z } from "zod";
import { SseEventType } from "@/type";
import { OnUsageUpdateParams } from "./type";

export type StreamStructuredOutputParams<TParsed, TTransformed = TParsed> = {
    /** System prompt for the LLM */
    systemPrompt: string;
    /** User prompt for the LLM */
    userPrompt: string;
    /** Optional AI SDK output schema for provider-guided structured generation */
    outputSchema?: z.ZodType<TParsed>;
    /** Zod schema to validate and parse the JSON response */
    schema: z.ZodSchema<TParsed>;
    /** Optional custom validation after schema parsing */
    validate?: (parsed: TParsed) => void;
    /** AbortSignal for cancellation */
    abortSignal: AbortSignal;
    /** Step name for delta events (e.g., "outline", "character_development") */
    eventName: SseEventType;
    /** Optional transform applied to the parsed result before success handling */
    transform?: (parsed: TParsed) => TTransformed | Promise<TTransformed>;
    /** Callback when the step completes successfully */
    onSuccess?: (result: TTransformed) => void | Promise<void>;
    /** Callback when the step completes successfully */
    onUsageUpdate?: (usage: OnUsageUpdateParams) => void | Promise<void>;
    /** Callback when an error occurs */
    onError: (error: Error) => void | Promise<void>;
    /** Callback when the stream is cancelled/aborted */
    onAbort: () => void | Promise<void>;
    /** Extra data merged into all emitted stream events for this step */
    baseEventData?: Record<string, unknown>;
    /** Whether to stream text deltas to the client (default: false) */
    streamTextDeltas?: boolean;
    /** Whether to stream reasoning deltas to the client (default: true) */
    streamReasoningDeltas?: boolean;
    /** OpenAI model to use (default: "gpt-5.1") */
    model?: string;
    /** Reasoning effort level (default: "low") */
    reasoningEffort?: "low" | "medium" | "high";
};

export type StreamLLMStepResult<T> = {
    /** The parsed result, or null if an error occurred */
    result: T | null;
    /** Error message if parsing/validation failed */
    error: string | null;
    /** Token usage for this step */
    usage: number;
    /** Whether the operation was aborted/cancelled */
    aborted: boolean;
};

// ---------------------------------------------------------------------------
// Core streaming function
// ---------------------------------------------------------------------------

/**
 * Executes a single LLM streaming step with JSON response parsing.
 * Handles cancellation, error streaming, and delta events.
 * 
 * @returns Result object with parsed data, error info, usage, and abort status
 */

export type YieldEventType<T> = {
    event: SseEventType
    type: 'start' | 'text_delta' |  'reasoning_delta' | 'usage' | 'success' | 'end' | 'alert'
    finishReason?: 'stop' | 'error' | 'abort'
    alertType?: 'error' | 'abort'
    data: T
}

export type StructuredOutputBatchContext<TBatchItem> = {
    batchItems: TBatchItem[];
    batchIndex: number;
};

type StructuredOutputBatchPromptValue<TBatchItem> =
    | string
    | ((context: StructuredOutputBatchContext<TBatchItem>) => string | Promise<string>);

export type StructuredOutputBatchPrompt<TBatchItem> = {
    system: StructuredOutputBatchPromptValue<TBatchItem>;
    user: StructuredOutputBatchPromptValue<TBatchItem>;
};

export type StreamStructuredOutputBatchParams<
    TBatchItem = unknown,
    TParsed = unknown,
    TTransformed = TParsed,
> = {
    items: TBatchItem[];
    batchSize: number;
    prompt: StructuredOutputBatchPrompt<TBatchItem>;
    outputSchema?: z.ZodType<TParsed>;
    schema: z.ZodSchema<TParsed>;
    validate?: (parsed: TParsed) => void;
    transform?: (
        parsed: TParsed,
        context: StructuredOutputBatchContext<TBatchItem>
    ) => TTransformed | Promise<TTransformed>;
    abortSignal: AbortSignal;
    eventName: SseEventType;
    onBatchStart?: (context: StructuredOutputBatchContext<TBatchItem>) => void | Promise<void>;
    onBatchSuccess?: (
        result: TTransformed,
        context: StructuredOutputBatchContext<TBatchItem>
    ) => void | Promise<void>;
    onBatchError?: (
        error: Error,
        context: StructuredOutputBatchContext<TBatchItem>
    ) => void | Promise<void>;
    stopOnBatchError?: boolean;
    onSuccess?: (result: TTransformed[]) => void | Promise<void>;
    onUsageUpdate?: (usage: OnUsageUpdateParams) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
    baseEventData?: Record<string, unknown>;
    model?: string;
    reasoningEffort?: "low" | "medium" | "high";
};

const chunkIntoBatches = <T>(items: T[], batchSize: number) => {
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += batchSize) {
        batches.push(items.slice(index, index + batchSize));
    }

    return batches;
};

const resolveStructuredOutputBatchPromptValue = async <TBatchItem>(
    value: StructuredOutputBatchPromptValue<TBatchItem>,
    context: StructuredOutputBatchContext<TBatchItem>
) => {
    if (typeof value === "function") {
        return await value(context);
    }

    return value;
};

export async function* streamStructuredOutput<TParsed, TTransformed = TParsed>({
    systemPrompt,
    userPrompt,
    outputSchema,
    schema,
    validate,
    abortSignal,
    eventName,
    transform,
    onSuccess,
    onUsageUpdate,
    onError,
    onAbort,
    baseEventData,
    streamTextDeltas = false,
    streamReasoningDeltas = true,
    model = "gpt-5.1",
    reasoningEffort = "low",
}: StreamStructuredOutputParams<TParsed, TTransformed>): AsyncGenerator<YieldEventType<unknown>, void, unknown> {
    let finishReason: 'stop' | 'error' | 'abort' = 'stop';
    const reportedErrors = new Set<string>();
    let abortReported = false;

    const setFinishReason = (next: 'stop' | 'error' | 'abort') => {
        if (finishReason === 'abort' || finishReason === 'error') {
            return;
        }

        finishReason = next;
    };

    const buildSuccessData = (result: TTransformed) => ({
        ...baseEventData,
        payload: result,
    });

    const output =
        outputSchema instanceof z.ZodArray
            ? Output.array({ element: outputSchema.element })
            : outputSchema
              ? Output.object({ schema: outputSchema })
              : undefined;

    yield { event: eventName, type: "start", data: { ...baseEventData } };

    try {
        const response = streamText({
            model: openai(model),
            ...(output ? { output } : {}),
            system: systemPrompt,
            prompt: userPrompt,
            abortSignal,
            providerOptions: { openai: { reasoningEffort } },
        });
        
        for await (const chunk of response.fullStream) {
            switch (chunk.type) {
                case "reasoning-delta":
                    if (streamReasoningDeltas) {
                        yield { event: eventName, type: "reasoning_delta", data: { ...baseEventData, text: chunk.text } };
                    }
                    break;
                case "text-delta":
                    if (streamTextDeltas) {
                        yield { event: eventName, type: "text_delta", data: { ...baseEventData, text: chunk.text } };
                    }
                    break;
                case "finish-step": {
                    const { totalTokens = 0, inputTokens = 0, outputTokens = 0 } = chunk.usage ?? {};

                    await onUsageUpdate?.({ totalTokens, inputTokens, outputTokens, model });
                    yield {
                        event: eventName,
                        type: "usage",
                        data: { ...baseEventData, totalTokens, inputTokens, outputTokens, model },
                    };
                    break;
                }
                case "error":
                    setFinishReason("error");
                    {
                        const errMsg = chunk.error instanceof Error ? chunk.error.message : String(chunk.error);
                        if (!reportedErrors.has(errMsg)) {
                            reportedErrors.add(errMsg);
                            await onError(new Error(errMsg));
                            yield { event: eventName, type: "alert", alertType: "error", data: { ...baseEventData, error: errMsg } };
                        }
                    }
                    break;
                case "abort":
                    finishReason = "abort";
                    if (!abortReported) {
                        abortReported = true;
                        await onAbort();
                        yield { event: eventName, type: "alert", alertType: "abort", data: { ...baseEventData } };
                    }
                    break;
                default:
                    break;
            }
        }

        if (finishReason === "stop") {
            try {
                const text = await response.text;
                const parsed = schema.parse(JSON.parse(text) as unknown) as TParsed;

                if (validate) {
                    validate(parsed);
                }

                const transformed = transform
                    ? await transform(parsed)
                    : (parsed as unknown as TTransformed);
                await onSuccess?.(transformed);
                yield {
                    event: eventName,
                    type: "success",
                    data: buildSuccessData(transformed),
                };
            } catch (parseError) {
                finishReason = "error";
                const errMsg =
                    parseError instanceof Error ? parseError.message : String(parseError);

                if (!reportedErrors.has(errMsg)) {
                    reportedErrors.add(errMsg);
                    await onError(new Error(errMsg));
                    yield { event: eventName, type: "alert", alertType: "error", data: { ...baseEventData, error: errMsg } };
                }
            }
        }
    } catch (error) {
        setFinishReason("error");
        const errMsg = error instanceof Error ? error.message : String(error);
        if (!reportedErrors.has(errMsg)) {
            reportedErrors.add(errMsg);
            await onError(new Error(errMsg));
            yield { event: eventName, type: "alert", alertType: "error", data: { ...baseEventData, error: errMsg } };
        }
    } finally {
        yield { event: eventName, type: "end", finishReason, data: { ...baseEventData } };
    }

}

export async function* streamStructuredOutputBatch<
    TBatchItem = unknown,
    TParsed = unknown,
    TTransformed = TParsed,
>({
    items,
    batchSize,
    prompt,
    outputSchema,
    schema,
    validate,
    transform,
    abortSignal,
    eventName,
    onBatchStart,
    onBatchSuccess,
    onBatchError,
    stopOnBatchError = true,
    onSuccess,
    onUsageUpdate,
    onError,
    onAbort,
    baseEventData,
    model = "gpt-5.1",
    reasoningEffort = "low",
}: StreamStructuredOutputBatchParams<
    TBatchItem,
    TParsed,
    TTransformed
>): AsyncGenerator<YieldEventType<unknown>, void, unknown> {
    let finishReason: 'stop' | 'error' | 'abort' = 'stop';
    let totalUsage = 0;
    const batchResults: TTransformed[] = [];
    const reportedErrors = new Set<string>();
    let abortReported = false;

    const setFinishReason = (next: 'stop' | 'error' | 'abort') => {
        if (finishReason === 'abort' || finishReason === 'error') {
            return;
        }

        finishReason = next;
    };

    const handleUsageUpdate = async (usage: OnUsageUpdateParams) => {
        totalUsage += usage.totalTokens;
        await onUsageUpdate?.(usage);
    };

    yield { event: eventName, type: "start", data: { ...baseEventData } };

    try {
        const batches = chunkIntoBatches(items, batchSize);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const currentBatch = batches[batchIndex];
            const context = {
                batchItems: currentBatch,
                batchIndex,
            };

            await onBatchStart?.(context);

            const systemPrompt = await resolveStructuredOutputBatchPromptValue(prompt.system, context);
            const userPrompt = await resolveStructuredOutputBatchPromptValue(prompt.user, context);

            let batchResult: TTransformed | null = null;
            let batchFinishReason: 'stop' | 'error' | 'abort' = 'stop';

            for await (const event of streamStructuredOutput({
                systemPrompt,
                userPrompt,
                outputSchema,
                schema,
                validate,
                transform: transform
                    ? async (parsed) => await transform(parsed, context)
                    : undefined,
                abortSignal,
                eventName,
                onSuccess: async (result) => {
                    batchResult = result;
                },
                onUsageUpdate: handleUsageUpdate,
                onError,
                onAbort: async () => {
                    if (!abortReported) {
                        abortReported = true;
                        await onAbort();
                    }
                },
                baseEventData: {
                    ...baseEventData,
                    batchIndex,
                },
                model,
                reasoningEffort,
            })) {
                if (event.type === "end") {
                    batchFinishReason = event.finishReason ?? 'stop';
                }

                yield event;
            }

            if (batchFinishReason === "abort") {
                finishReason = "abort";
                return;
            }

            if (batchFinishReason !== "stop" || batchResult == null) {
                finishReason = batchFinishReason;
                const error = new Error(`Batch ${batchIndex} failed to produce a valid result`);
                await onBatchError?.(error, context);
                if (stopOnBatchError) {
                    return;
                }
                continue;
            }

            batchResults.push(batchResult);
            await onBatchSuccess?.(batchResult, context);
        }

        await onSuccess?.(batchResults);
        yield {
            event: eventName,
            type: "success",
            data: {
                ...baseEventData,
                payload: batchResults,
                totalUsage,
            },
        };
    } catch (error) {
        setFinishReason("error");
        const errMsg = error instanceof Error ? error.message : String(error);
        if (!reportedErrors.has(errMsg)) {
            reportedErrors.add(errMsg);
            await onError(new Error(errMsg));
            yield {
                event: eventName,
                type: "alert",
                alertType: "error",
                data: { ...baseEventData, error: errMsg },
            };
        }
    } finally {
        yield {
            event: eventName,
            type: "end",
            finishReason,
            data: { ...baseEventData, totalUsage },
        };
    }
}

