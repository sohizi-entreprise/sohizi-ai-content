import { useCallback, useRef, useState, useEffect } from "react";
import { createParser } from "eventsource-parser";
import { parse as parsePartialJson } from "partial-json";
import { Block, Review, ScriptPlan, ScriptWriterEvent, StatusEvent } from "../type";


// ============================================================================
// CALLBACK TYPES
// ============================================================================

export type ScriptStreamCallback = {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
    // Event-specific callbacks
    onStatus?: (data: StatusEvent) => void;
    onPlanChunk?: (data: Partial<ScriptPlan>) => void;
    onPlanComplete?: (data: ScriptPlan) => void;
    onBlockChunk?: (data: Partial<Block>) => void;
    onReviewChunk?: (data: { blockId: string; chunk: Partial<Review> }) => void;
    onReview?: (data: { blockId: string; review: Review; iteration: number }) => void;
    onComplete?: (data: { blocks: Block[] }) => void;
};

// ============================================================================
// STATE TYPE
// ============================================================================

export type ScriptStreamState = {
    status: StatusEvent | null;
    plan: Partial<ScriptPlan> | null;
    currentBlock: Partial<Block> | null;
    currentReview: { blockId: string; chunk: Partial<Review> } | null;
    completedBlocks: Block[];
    reviews: { blockId: string; review: Review; iteration: number }[];
    isComplete: boolean;
};

// ============================================================================
// HOOK
// ============================================================================

export function useStreamScript(
    projectId: string,
    url: string,
    callback?: ScriptStreamCallback
) {
    const [state, setState] = useState<ScriptStreamState>({
        status: null,
        plan: null,
        currentBlock: null,
        currentReview: null,
        completedBlocks: [],
        reviews: [],
        isComplete: false,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);

    // Use refs to track the stream state and allow cleanup
    const abortControllerRef = useRef<AbortController | null>(null);
    // Store callbacks in ref to avoid dependency issues
    const callbackRef = useRef(callback);

    // Update callback ref when it changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const resetState = useCallback(() => {
        setState({
            status: null,
            plan: null,
            currentBlock: null,
            currentReview: null,
            completedBlocks: [],
            reviews: [],
            isComplete: false,
        });
        setError(undefined);
    }, []);

    const startStream = useCallback(async () => {
        // Reset state
        resetState();
        setIsLoading(true);

        // Call onStart callback
        callbackRef.current?.onStart?.();

        // Create abort controller for cleanup
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const parser = createParser({
            onEvent: (event) => {
                if (event.event === "start") {
                    // Stream started
                    return;
                }

                if (event.event === "end") {
                    setIsLoading(false);
                    callbackRef.current?.onEnd?.();
                    return;
                }

                // Parse the event data
                try {
                    const data = parsePartialJson(event.data);
                    const eventType = event.event as ScriptWriterEvent["type"];

                    switch (eventType) {
                        case "status": {
                            const statusData = data as StatusEvent;
                            setState((prev) => ({ ...prev, status: statusData }));
                            callbackRef.current?.onStatus?.(statusData);
                            break;
                        }

                        case "plan_chunk": {
                            const planData = data as Partial<ScriptPlan>;
                            setState((prev) => ({
                                ...prev,
                                plan: { ...prev.plan, ...planData },
                            }));
                            callbackRef.current?.onPlanChunk?.(planData);
                            break;
                        }

                        case "plan_complete": {
                            const planData = data as ScriptPlan;
                            setState((prev) => ({ ...prev, plan: planData }));
                            callbackRef.current?.onPlanComplete?.(planData);
                            break;
                        }

                        case "block": {
                            const blockData = data as Partial<Block>;
                            setState((prev) => ({
                                ...prev,
                                currentBlock: { ...prev.currentBlock, ...blockData },
                            }));
                            callbackRef.current?.onBlockChunk?.(blockData);
                            break;
                        }

                        case "review_chunk": {
                            const reviewChunkData = data as { blockId: string; chunk: Partial<Review> };
                            setState((prev) => ({
                                ...prev,
                                currentReview: reviewChunkData,
                            }));
                            callbackRef.current?.onReviewChunk?.(reviewChunkData);
                            break;
                        }

                        case "review": {
                            const reviewData = data as { blockId: string; review: Review; iteration: number };
                            setState((prev) => ({
                                ...prev,
                                reviews: [...prev.reviews, reviewData],
                                currentReview: null,
                            }));
                            callbackRef.current?.onReview?.(reviewData);
                            break;
                        }

                        case "complete": {
                            const completeData = data as { blocks: Block[] };
                            setState((prev) => ({
                                ...prev,
                                completedBlocks: completeData.blocks,
                                isComplete: true,
                                currentBlock: null,
                            }));
                            callbackRef.current?.onComplete?.(completeData);
                            break;
                        }

                        case "error": {
                            const errorData = data as { message: string };
                            const errorObj = new Error(errorData.message);
                            setError(errorObj);
                            callbackRef.current?.onError?.(errorObj);
                            break;
                        }
                    }
                } catch (e) {
                    // Partial JSON might not be complete yet, that's okay
                    console.debug("Failed to parse event data:", e);
                }
            },
            onError: (e) => {
                const error = e instanceof Error ? e : new Error(String(e));
                setError(error);
                setIsLoading(false);
                callbackRef.current?.onError?.(error);
            },
        });

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: abortController.signal,
            });

            if (!res.ok) throw new Error(`Failed to start script generation: ${res.status}`);
            if (!res.body) throw new Error("ReadableStream not available on this response.");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                parser.feed(chunk);
            }
        } catch (error) {
            // Don't set error if it was an abort
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            console.error("Stream error:", error);
            const errorObj = error instanceof Error ? error : new Error(String(error));
            setError(errorObj);
            setIsLoading(false);
            callbackRef.current?.onError?.(errorObj);
            callbackRef.current?.onEnd?.();
        }
    }, [url, resetState]);

    const stopStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
        }
    }, []);

    // Cleanup on unmount or when projectId changes
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [projectId]);

    return {
        // State
        state,
        isLoading,
        error,
        // Convenience accessors
        status: state.status,
        plan: state.plan,
        currentBlock: state.currentBlock,
        completedBlocks: state.completedBlocks,
        reviews: state.reviews,
        isComplete: state.isComplete,
        // Actions
        startStream,
        stopStream,
        resetState,
    };
}
