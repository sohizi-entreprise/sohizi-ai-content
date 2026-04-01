import { generationRequestSchema } from './schema'
import { z } from 'zod'
import { BadRequest, InternalServerError, NotFound } from '../error'
import { createGenerationRequest, getActiveRequests, getGenerationRequestById, updateGenerationRequest } from './repo'
import { projectRepo } from '@/entities/project'
import { abortManager } from './abort-manager'
import { getHandler } from './handler-factory'
import { payloadAdapter } from './payload-adapter'
import { GenerationRequestType } from '@/type'
import { readStreamEvents } from './stream-handler'
import { eventNameMap, inngest } from '@/lib/inngest'

type GenerationRequestPayload = z.infer<typeof generationRequestSchema>

export const handleGenerationRequest = async (projectId: string, requestPayload: GenerationRequestPayload) => {
    const isValid = generationRequestSchema.safeParse(requestPayload)
    if (!isValid.success) {
        throw new BadRequest(`Invalid request payload: ${isValid.error.message}`)
    }

    const project = await projectRepo.getProjectById(projectId)
    if (!project) {
        throw new NotFound('Project not found')
    }

    const {type, ...metadata} = requestPayload
 
    try {
        const request = await createGenerationRequest({
            projectId,
            type: type as GenerationRequestType,
            metadata: metadata || {},
        })

        const abortController = abortManager.registerGeneration(request.id)
        const handler = getHandler(type as GenerationRequestType)
        if (!handler) {
            throw new InternalServerError('Handler not found for type: ' + type)
        }

        // Get the payload
        let payload: Awaited<ReturnType<typeof payloadAdapter>>
        try {
            payload = await payloadAdapter(requestPayload, project)
        } catch (error) {
            let errorMessage = String(error)
            if (error instanceof Error) {
                errorMessage = error.message
            }
            throw new BadRequest('Failed to get payload: ' + errorMessage)
        }
        const eventName = eventNameMap[type as GenerationRequestType]
        if (!eventName) {
            throw new BadRequest('Invalid generation request type: ' + type)
        }
        // Enqueue the generation request
        await inngest.send({
            name: eventName,
            data: {
                payload,
                projectId,
                requestId: request.id,
                abortSignal: abortController.signal,
            },
        })

        return {
            success: true,
            taskId: request.id,
            status: request.status,
        }
    } catch (error) {
        throw new InternalServerError('Failed to create generation request. Please try again later.')
    }

}

export const listActiveGenerationRequests = async (projectId: string) => {
    const requests = await getActiveRequests(projectId)
    return requests
}

export const cancelGenerationRequest = async (projectId: string, requestId: string) => {
    const request = await getGenerationRequestById(projectId, requestId)
    if (!request) {
        throw new NotFound('Generation request not found')
    }
    if (request.status !== 'ENQUEUED' && request.status !== 'PROCESSING') {
        throw new BadRequest('Task is on final state and cannot be cancelled')
    }
    await abortManager.broadcastCancellation(requestId)
    await updateGenerationRequest(requestId, { status: 'CANCELED' })

    return {
        success: true,
        status: 'CANCELED',
    }
}

export async function* sendSseEvents(streamKey: string, request: Request) {
    const lastEventId = request.headers.get('Last-Event-ID') || undefined

    yield* readStreamEvents({
        streamId: streamKey,
        lastEventId,
        emitHandshake: true,
        onInvalidEntry: async (entry) => {
            console.warn('Skipping invalid stream entry', {
                streamId: streamKey,
                entryId: entry.id,
                reason: entry.reason,
                error: entry.error,
            })
        },
    })
}