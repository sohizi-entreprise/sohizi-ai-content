export type OnUsageUpdateParams = {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    model: string;
}

export type BaseGeneratorParams<T, P> = {
    payload: P;
    onSuccess: (data: T) => void | Promise<void>;
    onError: (error: Error) => void | Promise<void>;
    onUsageUpdate: (usage: OnUsageUpdateParams) => void | Promise<void>;
    onAbort: () => void | Promise<void>;
    abortSignal: AbortSignal;
}