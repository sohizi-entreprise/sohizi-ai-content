import { updateGenerationRequest } from "./repo";
import { generateConcept } from "../ai/generators/concept";
import { projectRepo } from "@/entities/project";
import { generateSynopsis } from "../ai/generators/synopsis";
import { generateStoryBible } from "../ai/generators/story-bible";
import { generateEntity } from "../ai/generators/entity";
import { generateScene } from "../ai/generators/scene";
import { type PayloadByType } from "./payload-adapter";
import { YieldEventType } from "../ai/stream-llm";


export type GeneratorHandler<T extends keyof PayloadByType> = (
    payload: PayloadByType[T],
    projectId: string,
    requestId: string,
    abortSignal: AbortSignal
) => AsyncGenerator<YieldEventType<unknown>, void, unknown>;

export const allGeneratorHandlers = () => ({
    GENERATE_CONCEPT: handleConceptGeneration,
    GENERATE_SYNOPSIS: handleSynopsisGeneration,
    GENERATE_STORY_BIBLE: handleStoryBibleGeneration,
    GENERATE_ENTITY: handleEntityGeneration,
    GENERATE_SCENE: handleSceneGeneration,
    // CHAT_COMPLETION: handleChatCompletion,
})


const handleConceptGeneration: GeneratorHandler<"GENERATE_CONCEPT"> = (
    payload,
    projectId,
    requestId,
    abortSignal
) => {

    return generateConcept({
        payload: payload.brief,
        async onSuccess(data) {
            await projectRepo.updateProject(projectId, { narrative_arcs: data })
            await updateGenerationRequest(requestId, { status: 'COMPLETED' })
        },
        async onError(error) {
            await updateGenerationRequest(requestId, { status: 'FAILED', error: error.message })
        },
        async onAbort() {
            await updateGenerationRequest(requestId, { status: 'CANCELED' })
        },
        onUsageUpdate(usage) {
            console.log('Usage:', usage)
        },
        abortSignal,
    })
}

const handleSynopsisGeneration: GeneratorHandler<"GENERATE_SYNOPSIS"> = (
    payload,
    projectId,
    requestId,
    abortSignal
) => {
    return generateSynopsis({
        payload,
        async onSuccess(data) {
            await projectRepo.updateProject(projectId, { synopsis: data })
            await updateGenerationRequest(requestId, { status: 'COMPLETED' })
        },
        async onError(error) {
            await updateGenerationRequest(requestId, { status: 'FAILED', error: error.message })
        },
        async onAbort() {
            await updateGenerationRequest(requestId, { status: 'CANCELED' })
        },
        onUsageUpdate(usage) {
            console.log('Usage:', usage)
        },
        abortSignal,
    })
}

const handleStoryBibleGeneration: GeneratorHandler<"GENERATE_STORY_BIBLE"> = (
    payload,
    projectId,
    requestId,
    abortSignal
) => {
    return generateStoryBible({
        payload: payload.synopsis,
        async onSuccess(data) {
            await projectRepo.updateProject(projectId, { story_bible: data })
            await updateGenerationRequest(requestId, { status: 'COMPLETED' })
        },
        async onError(error) {
            await updateGenerationRequest(requestId, { status: 'FAILED', error: error.message })
        },
        async onAbort() {
            await updateGenerationRequest(requestId, { status: 'CANCELED' })
        },
        onUsageUpdate(usage) {
            console.log('Usage:', usage)
        },
        abortSignal,
    })
}

const handleEntityGeneration: GeneratorHandler<"GENERATE_ENTITY"> = (
    payload,
    projectId,
    requestId,
    abortSignal
) => {
    return generateEntity({
        payload,
        async onSuccess(data) {
            await projectRepo.cleanAndUpsertAllEntities(projectId, data)
            await updateGenerationRequest(requestId, { status: 'COMPLETED' })
        },
        async onError(error) {
            await updateGenerationRequest(requestId, { status: 'FAILED', error: error.message })
        },
        async onAbort() {
            await updateGenerationRequest(requestId, { status: 'CANCELED' })
        },
        onUsageUpdate(usage) {
            console.log('Usage:', usage)
        },
        abortSignal,
    })
}

const handleSceneGeneration: GeneratorHandler<"GENERATE_SCENE"> = (
    payload,
    projectId,
    requestId,
    abortSignal
) => {
    return generateScene({
        payload,
        async onSuccess(data) {
            await projectRepo.replaceScenes(projectId, data)
            await updateGenerationRequest(requestId, { status: 'COMPLETED' })
        },
        async onError(error) {
            await updateGenerationRequest(requestId, { status: 'FAILED', error: error.message })
        },
        async onAbort() {
            await updateGenerationRequest(requestId, { status: 'CANCELED' })
        },
        onUsageUpdate(usage) {
            console.log('Usage:', usage)
        },
        abortSignal,
    })
}