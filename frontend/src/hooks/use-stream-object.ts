import { useCallback, useRef, useState, useEffect } from "react";
import { createParser } from "eventsource-parser";
import { parse as parsePartialJson } from "partial-json";
import z from "zod";

type StreamCallback<T> = {
    onStart?: () => void;
    onUpdate?: (data: T) => void;
    onEnd?: () => void;
    onFinish?: (data: T) => void;
    onError?: (error: Error) => void;
}

// Overload when transformFunc is provided
export function useStreamObject<T extends z.ZodSchema, TFunc>(
    projectId: string,
    schema: T,
    url: string,
    transformFunc: (data: z.infer<T>) => TFunc,
    callback?: StreamCallback<TFunc>
): {
    object: TFunc | undefined;
    isLoading: boolean;
    error: Error | undefined;
    startStream: () => Promise<void>;
};

// Overload when transformFunc is not provided
export function useStreamObject<T extends z.ZodSchema>(
    projectId: string,
    schema: T,
    url: string,
    callback?: StreamCallback<z.infer<T>>
): {
    object: z.infer<T> | undefined;
    isLoading: boolean;
    error: Error | undefined;
    startStream: () => Promise<void>;
};

// Implementation
export function useStreamObject<T extends z.ZodSchema, TFunc = z.infer<T>>(
    projectId: string,
    _schema: T,
    url: string,
    transformFuncOrCallback?: ((data: z.infer<T>) => TFunc) | StreamCallback<z.infer<T>>,
    callbackOrUndefined?: StreamCallback<TFunc>
) {
    // Determine if transformFunc is provided by checking if the 4th arg is a function
    const transformFunc = typeof transformFuncOrCallback === 'function' 
        ? transformFuncOrCallback 
        : undefined;
    const callback = typeof transformFuncOrCallback === 'function'
        ? callbackOrUndefined
        : transformFuncOrCallback;

    const [object, setObject] = useState<TFunc | z.infer<T> | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    
    // Use refs to track the stream state and allow cleanup
    const abortControllerRef = useRef<AbortController | null>(null);
    const jsonBufferRef = useRef<string>("");
    // Store callbacks in ref to avoid dependency issues
    const callbackRef = useRef(callback);
    
    // Update callback ref when it changes
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    const startStream = useCallback(async () => {
        // Reset state
        setObject(undefined);
        setError(undefined);
        setIsLoading(true);
        jsonBufferRef.current = "";

        // Call onStart callback
        callbackRef.current?.onStart?.();

        // Create abort controller for cleanup
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const parser = createParser({
            onEvent: (event) => {
                if (event.event === 'start') {
                    jsonBufferRef.current = ""; // Reset buffer on start
                } else if (event.event === 'chunk_delta') {
                    jsonBufferRef.current = event.data;
                    // Try to parse partial JSON and update state
                    try {
                        const partial = parsePartialJson(jsonBufferRef.current) as z.infer<T>;
                        if (transformFunc) {
                            const transformed = transformFunc(partial);
                            setObject(transformed);
                            // Call onUpdate callback with transformed data
                            (callbackRef.current as StreamCallback<TFunc> | undefined)?.onUpdate?.(transformed);
                        } else {
                            setObject(partial);
                            // Call onUpdate callback with original data
                            (callbackRef.current as StreamCallback<z.infer<T>> | undefined)?.onUpdate?.(partial);
                        }
                    } catch (e) {
                        // Partial JSON might not be complete yet, that's okay
                    }
                } else if (event.event === 'end') {
                    // Parse final JSON
                    try {
                        const final = JSON.parse(jsonBufferRef.current) as z.infer<T>;
                        if (transformFunc) {
                            const transformed = transformFunc(final);
                            setObject(transformed);
                            // Call onFinish callback with transformed data
                            (callbackRef.current as StreamCallback<TFunc> | undefined)?.onFinish?.(transformed);
                        } else {
                            setObject(final);
                            // Call onFinish callback with original data
                            (callbackRef.current as StreamCallback<z.infer<T>> | undefined)?.onFinish?.(final);
                        }
                    } catch (e) {
                        const error = new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : String(e)}`);
                        setError(error);
                        // Call onError callback
                        callbackRef.current?.onError?.(error);
                    } finally {
                        setIsLoading(false);
                        // Call onEnd callback
                        callbackRef.current?.onEnd?.();
                    }
                }
            },
            onError: (e) => {
                const error = e instanceof Error ? e : new Error(String(e));
                setError(error);
                setIsLoading(false);
                // Call onError callback
                callbackRef.current?.onError?.(error);
            }
        });

        try {
            const res = await fetch(url, {
                method: 'POST',
                signal: abortController.signal,
            });
            
            if (!res.ok) throw new Error("Failed to fetch brief");
            if (!res.body) throw new Error("ReadableStream not available on this response.");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
        
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
            
                const chunk = decoder.decode(value, { stream: true });
                // Feed chunks to the parser
                parser.feed(chunk);
            }
            
        } catch (error) {
            // Don't set error if it was an abort
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            console.error('Error:', error);
            const errorObj = error instanceof Error ? error : new Error(String(error));
            setError(errorObj);
            setIsLoading(false);
            // Call onError callback
            callbackRef.current?.onError?.(errorObj);
            callbackRef.current?.onEnd?.();
        }
    }, [projectId, url, transformFunc]);

    // Cleanup on unmount or when projectId changes
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [projectId]);

    return {
        object,
        isLoading,
        error,
        startStream,
    };
}
