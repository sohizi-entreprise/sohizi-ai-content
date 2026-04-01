import { z } from 'zod'

export const generateConceptSchema = z.object({
    type: z.literal('GENERATE_CONCEPT'),
})

export const generateSynopsisSchema = z.object({
    type: z.literal('GENERATE_SYNOPSIS'),
})

export const generateSceneSchema = z.object({
    type: z.literal('GENERATE_SCENE'),
})

export const generateStoryBibleSchema = z.object({
    type: z.literal('GENERATE_STORY_BIBLE'),
})

export const generateEntitySchema = z.object({
    type: z.literal('GENERATE_ENTITY'),
})

export const generateChatCompletionSchema = z.object({
    type: z.literal('CHAT_COMPLETION'),
    data: z.object({
        prompt: z.string().min(1),
    })
})

export const generationRequestSchema = z.discriminatedUnion('type', [
    generateConceptSchema,
    generateSynopsisSchema,
    generateSceneSchema,
    generateStoryBibleSchema,
    generateEntitySchema,
    generateChatCompletionSchema,
])