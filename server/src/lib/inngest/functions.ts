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
            console.log('generate-concept', payload, projectId, requestId, abortSignal)
        })
    }
)
