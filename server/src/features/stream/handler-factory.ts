import { GenerationRequestStatus, GenerationRequestType } from "@/type";
import { updateGenerationRequest } from "./repo";
import { type PayloadByType } from "./payload-adapter";
import { YieldEventType } from "../ai/stream-llm";
import { allGeneratorHandlers } from "./generator-handlers";
import { writeStreamEvent } from "./stream-handler";

export type GeneratorHandler<T extends keyof PayloadByType> = (
    payload: PayloadByType[T],
    projectId: string,
    requestId: string,
    abortSignal: AbortSignal
) => AsyncGenerator<YieldEventType<unknown>, void, unknown>;

type AnyGeneratorHandler = {
    [K in keyof PayloadByType]: GeneratorHandler<K>
}[keyof PayloadByType];
export type HandlerParams = Parameters<GeneratorHandler<keyof PayloadByType>>;


export const getHandler = (type: GenerationRequestType) => {
    const handler = allGeneratorHandlers()[type]
    if (!handler) {
        return null
    }
    return wrapperHandler(handler as AnyGeneratorHandler)
}

function wrapperHandler(handler: AnyGeneratorHandler){
    const execute = handler as (...params: HandlerParams) => AsyncGenerator<YieldEventType<unknown>, void, unknown>;

    return async (...params: HandlerParams) => {
        const [payload, projectId, requestId, abortSignal] = params
        let error: Error | null = null
        let status: GenerationRequestStatus = 'PROCESSING'
        try {
            await updateGenerationRequest(requestId, { status })
            for await (const event of execute(payload, projectId, requestId, abortSignal)) {
                // Push the event to the stream
                const pushEvent = {...event, requestId}
                await writeStreamEvent(requestId, pushEvent)
            }
            status = 'COMPLETED'
        } catch (e) {
            error = e instanceof Error ? e : new Error(String(e))
            status = 'FAILED'
        }
        finally {
            await updateGenerationRequest(requestId, { status, error: error?.message })
        }
    }
}
