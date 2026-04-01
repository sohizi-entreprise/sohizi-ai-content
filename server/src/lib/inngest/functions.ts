import { getHandler, GeneratorHandler } from "@/features/stream/handler-factory";
import { inngest } from "./client";
import { PayloadByType } from "@/features/stream/payload-adapter";

export type EventPayload<T extends keyof PayloadByType> = {
    payload: PayloadByType[T],
    projectId: string,
    requestId: string,
    abortSignal: AbortSignal
}

export const eventNameMap = {
    'GENERATE_CONCEPT': 'project/generation.concept',
    'GENERATE_SYNOPSIS': 'project/generation.synopsis',
    'GENERATE_STORY_BIBLE': 'project/generation.story-bible',
    'GENERATE_ENTITY': 'project/generation.entity',
    'GENERATE_SCENE': 'project/generation.scene',
} as const;

export const handleConceptGeneration = inngest.createFunction(
    {
        id: 'concept-generation', 
        triggers: [{ event: "project/generation.concept"}]
    },
    async({event, step})=>{
        const {payload, projectId, requestId, abortSignal} = event.data as EventPayload<'GENERATE_CONCEPT'>
        
        await step.run('generate-concept', async()=>{
            const handler = getHandler('GENERATE_CONCEPT')
            if (!handler) {
                throw new Error('Handler not found')
            }
            await handler(payload, projectId, requestId, abortSignal)
        })
    }
)

export const handleSynopsisGeneration = inngest.createFunction(
    {
        id: 'synopsis-generation',
        triggers: [{ event: "project/generation.synopsis"}]
    },
    async({event, step})=>{
        const {payload, projectId, requestId, abortSignal} = event.data as EventPayload<'GENERATE_SYNOPSIS'>
        
        await step.run('generate-synopsis', async()=>{
            const handler = getHandler('GENERATE_SYNOPSIS')
            if (!handler) {
                throw new Error('Handler not found')
            }
            await handler(payload, projectId, requestId, abortSignal)
        })

    }
)

export const handleStoryBibleGeneration = inngest.createFunction(
    {
        id: 'story-bible-generation',
        triggers: [{ event: "project/generation.story-bible"}]
    },
    async({event, step})=>{
        const {payload, projectId, requestId, abortSignal} = event.data as EventPayload<'GENERATE_STORY_BIBLE'>

        await step.run('generate-story-bible', async()=>{
            const handler = getHandler('GENERATE_STORY_BIBLE')
            if (!handler) {
                throw new Error('Handler not found')
            }
            await handler(payload, projectId, requestId, abortSignal)
        })
    }
)

export const handleEntityGeneration = inngest.createFunction(
    {
        id: 'entity-generation',
        triggers: [{ event: "project/generation.entity"}]
    },
    async({event, step})=>{
        const {payload, projectId, requestId, abortSignal} = event.data as EventPayload<'GENERATE_ENTITY'>

        await step.run('generate-entities', async()=>{
            const handler = getHandler('GENERATE_ENTITY')
            if (!handler) {
                throw new Error('Handler not found')
            }
            await handler(payload, projectId, requestId, abortSignal)
        })
    }
)

export const handleSceneGeneration = inngest.createFunction(
    {
        id: 'scene-generation',
        triggers: [{ event: "project/generation.scene"}]
    },
    async({event, step})=>{
        const {payload, projectId, requestId, abortSignal} = event.data as EventPayload<'GENERATE_SCENE'>

        await step.run('generate-scene', async()=>{
            const handler = getHandler('GENERATE_SCENE')
            if (!handler) {
                throw new Error('Handler not found')
            }
            await handler(payload, projectId, requestId, abortSignal)
        })
    }
)
