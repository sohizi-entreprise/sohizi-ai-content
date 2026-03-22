import { streamText } from "ai";
import { openai } from "@/lib/llm-providers";
import { ResumableStream, StreamEvent, StreamEventType } from "@/lib";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StreamLLMStepParams<T> = {
    /** System prompt for the LLM */
    systemPrompt: string;
    /** User prompt for the LLM */
    userPrompt: string;
    /** Zod schema to validate and parse the JSON response */
    schema: z.ZodSchema<T>;
    /** Optional custom validation after schema parsing */
    validate?: (parsed: T) => void;
    /** ResumableStream instance for pushing events */
    stream: ResumableStream;
    /** Unique run identifier */
    runId: string;
    /** AbortSignal for cancellation */
    abortSignal: AbortSignal;
    /** Event type for delta/progress events (e.g., "story_bible_delta") */
    deltaEventType: StreamEventType;
    /** Event type for error events (e.g., "story_bible_error") */
    errorEventType: StreamEventType;
    /** Step name for delta events (e.g., "outline", "character_development") */
    stepName: string;
    /** Optional batch index for batch operations */
    batchIndex?: number;
    /** Callback when the step starts */
    onStart?: () => void | Promise<void>;
    /** Callback when the step completes successfully */
    onFinish?: (result: T, usage: number) => void | Promise<void>;
    /** Callback when an error occurs */
    onError: (error: Error) => void | Promise<void>;
    /** Callback when the stream is cancelled/aborted */
    onAbort: () => void | Promise<void>;
    /** Extra data merged into all emitted stream events for this step */
    baseEventData?: Record<string, unknown>;
    /** Build custom delta payload data. Receives the parsed result. */
    buildDeltaPayload?: (parsed: T) => Record<string, unknown>;
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
export async function streamLLMStep<T>({
    systemPrompt,
    userPrompt,
    schema,
    validate,
    stream,
    runId,
    abortSignal,
    deltaEventType,
    errorEventType,
    stepName,
    batchIndex,
    onStart,
    onFinish,
    onError,
    onAbort,
    baseEventData,
    buildDeltaPayload,
    streamTextDeltas = false,
    streamReasoningDeltas = true,
    model = "gpt-5.1",
    reasoningEffort = "low",
}: StreamLLMStepParams<T>): Promise<StreamLLMStepResult<T>> {
    let result: T | null = null;
    let usage = 0;
    const state = { error: null as string | null };

    if (onStart) {
        await onStart();
    }

    const response = streamText({
        model: openai(model),
        system: systemPrompt,
        prompt: userPrompt,
        abortSignal,
        providerOptions: { openai: { reasoningEffort } },
        onAbort,
        onError (error){
            if (error instanceof Error) {
                onError(error);
            } else {
                onError(new Error(JSON.stringify(error)));
            }
        },
        onFinish: async ({ text, totalUsage: u }) => {
            usage = u?.totalTokens ?? 0;
            try {
                const parsed = JSON.parse(text) as unknown;
                result = schema.parse(parsed) as T;
                
                if (validate) {
                    validate(result);
                }

                const deltaData: Record<string, unknown> = {
                    runId,
                    ...baseEventData,
                    step: stepName,
                    ...(batchIndex !== undefined && { batchIndex }),
                    ...(buildDeltaPayload ? buildDeltaPayload(result) : { payload: result }),
                };

                await stream.push({
                    type: deltaEventType,
                    data: deltaData,
                });
            } catch (parseError) {
                const errMsg =
                    parseError instanceof Error ? parseError.message : String(parseError);
                state.error = `${stepName} parse error: ${errMsg}`;
            }
        },
    });

    for await (const chunk of response.fullStream) {
        if (await stream.isCancelled()) {
            return { result: null, error: null, usage, aborted: true };
        }

        let event: StreamEvent<unknown> | null = null;
        switch (chunk.type) {
            case "reasoning-delta":
                if (streamReasoningDeltas) {
                    event = {
                        type: deltaEventType,
                        data: { runId, ...baseEventData, type: "reasoning", text: chunk.text },
                    };
                }
                break;
            case "text-delta":
                if (streamTextDeltas) {
                    event = {
                        type: deltaEventType,
                        data: { runId, ...baseEventData, type: "text", text: chunk.text },
                    };
                }
                break;
            case "error":
                const errMsg = chunk.error instanceof Error ? chunk.error.message : String(chunk.error);
                event = { type: errorEventType, data: { runId, ...baseEventData, error: errMsg } };
                await onError(new Error(errMsg));
                break;
            default:
                break;
        }
        if (event) await stream.push(event);
    }

    if (result && !state.error && onFinish) {
        await onFinish(result, usage);
    }

    return {
        result,
        error: state.error,
        usage,
        aborted: false,
    };
}

// ---------------------------------------------------------------------------
// Batch helper
// ---------------------------------------------------------------------------

export type BatchStreamParams<TInput, TOutput> = {
    /** Items to process in batches */
    items: TInput[];
    /** Batch size */
    batchSize: number;
    /** Build params for each batch */
    buildBatchParams: (
        batchItems: TInput[],
        batchIndex: number
    ) => Omit<
        StreamLLMStepParams<TOutput>,
        "stream" | "runId" | "abortSignal" | "onError" | "onAbort" | "deltaEventType" | "errorEventType"
    >;
    /** ResumableStream instance */
    stream: ResumableStream;
    /** Unique run identifier */
    runId: string;
    /** AbortController for cancellation */
    abortController: AbortController;
    /** Event type for delta events */
    deltaEventType: StreamEventType;
    /** Event type for error events */
    errorEventType: StreamEventType;
    /** Callback when the batch processing starts */
    onStart?: () => void | Promise<void>;
    /** Callback when all batches complete successfully */
    onFinish?: (results: TOutput[], totalUsage: number) => void | Promise<void>;
    /** Callback when an error occurs */
    onError: (error: Error) => void | Promise<void>;
    /** Callback when aborted */
    onAbort: () => void | Promise<void>;
};

export type BatchStreamResult<TOutput> = {
    /** All results from successful batches */
    results: TOutput[];
    /** Total token usage across all batches */
    totalUsage: number;
    /** Whether any batch failed */
    hasError: boolean;
    /** Error message if a batch failed */
    error: string | null;
    /** Whether the operation was aborted */
    aborted: boolean;
};

/**
 * Process items in batches, calling streamLLMStep for each batch.
 * Stops on first error or cancellation.
 */
export async function streamLLMBatch<TInput, TOutput>({
    items,
    batchSize,
    buildBatchParams,
    stream,
    runId,
    abortController,
    deltaEventType,
    errorEventType,
    onStart,
    onFinish,
    onError,
    onAbort,
}: BatchStreamParams<TInput, TOutput>): Promise<BatchStreamResult<TOutput>> {
    const allResults: TOutput[] = [];
    let totalUsage = 0;
    let processedSoFar = 0;

    if (onStart) {
        await onStart();
    }

    const batches: TInput[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (await stream.isCancelled()) {
            abortController.abort();
            await stream.close();
            await onAbort();
            return { results: allResults, totalUsage, hasError: false, error: null, aborted: true };
        }

        const batchItems = batches[batchIndex];
        const batchParams = buildBatchParams(batchItems, batchIndex);

        await stream.push({
            type: "batch_progress",
            data: {
                runId,
                processedSoFar,
                total: items.length,
                currentBatch: batchItems,
            },
        });

        const stepResult = await streamLLMStep<TOutput>({
            ...batchParams,
            stream,
            runId,
            abortSignal: abortController.signal,
            deltaEventType,
            errorEventType,
            batchIndex,
            onError,
            onAbort,
        });

        totalUsage += stepResult.usage;

        if (stepResult.aborted) {
            abortController.abort();
            await stream.close();
            await onAbort();
            return { results: allResults, totalUsage, hasError: false, error: null, aborted: true };
        }

        if (stepResult.error) {
            await onError(new Error(stepResult.error));
            await stream.push({
                type: errorEventType,
                data: { runId, error: stepResult.error },
            });
            await stream.close();
            return { results: allResults, totalUsage, hasError: true, error: stepResult.error, aborted: false };
        }

        if (stepResult.result) {
            allResults.push(stepResult.result);
        }

        processedSoFar += batchItems.length;
    }

    if (onFinish) {
        await onFinish(allResults, totalUsage);
    }

    return { results: allResults, totalUsage, hasError: false, error: null, aborted: false };
}
