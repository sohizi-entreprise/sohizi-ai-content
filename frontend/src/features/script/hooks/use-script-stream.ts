import { useCallback, useRef, useState, useEffect } from "react";
import { createParser } from "eventsource-parser";
import { parse as parsePartialJson } from "partial-json";
import { AgentChunk, BlockChunk, ScriptEventLog, ScriptStreamEvent, ScriptStreamEventType } from "../type";


// ============================================================================
// CALLBACK TYPES
// ============================================================================

export type ScriptStreamCallback = {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: Error) => void;
    // Event-specific callbacks
    onAgentChunk?: (runId:string, content:Partial<ScriptEventLog>) => void;
    onBlockChunk?: (data: BlockChunk) => void;
    onReviewChunk?: (runId:string, content:string) => void;
};

// export type ScriptEventLog = {
//     runId: string;
//     content: string;
// }

// export type ScriptStreamState = {
//     eventLogs: ScriptEventLog[];
//     scriptBlocks: Block[];
// };

export function useScriptStream(
    projectId: string,
    url: string,
    callback?: ScriptStreamCallback
) {
    // const [state, setState] = useState<ScriptStreamState>({
    //     eventLogs: [],
    //     scriptBlocks: [],
    // });

    const [isStreaming, setIsStreaming] = useState(false);
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
        setError(undefined);
    }, []);

    const startStream = useCallback(async (userPrompt: string) => {
        // Reset state
        resetState();
        setIsStreaming(true);

        // Call onStart callback
        callbackRef.current?.onStart?.();

        // Create abort controller for cleanup
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const parser = createParser({
            onEvent: (event) => {
                const eventName = event.event as ScriptStreamEventType;
                if (eventName === "start") {
                    // Stream started
                    return;
                }

                if (eventName === "end") {
                    setIsStreaming(false);
                    callbackRef.current?.onEnd?.();
                    return;
                }

                // Parse the event data
                try {
                    const data = JSON.parse(event.data) as ScriptStreamEvent;

                    switch (eventName) {
                        case "agent": {
                            const agentData = data as AgentChunk;
                            callbackRef.current?.onAgentChunk?.(agentData.runId, parsePartialJson(agentData.data));
                            break;
                        }

                        case "writer": {
                            const payloadData = data as BlockChunk;
                            callbackRef.current?.onBlockChunk?.(payloadData);
                            break;
                        }

                        case "reviewer": {
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
                setIsStreaming(false);
                callbackRef.current?.onError?.(error);
            },
        });

        try {
            const res = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({prompt: userPrompt}),
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
            setIsStreaming(false);
            callbackRef.current?.onError?.(errorObj);
            callbackRef.current?.onEnd?.();
        }
    }, [url, resetState]);

    const stopStream = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsStreaming(false);
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
        isStreaming,
        error,
        // Actions
        startStream,
        stopStream,
        resetState,
    };
}
