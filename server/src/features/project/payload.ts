import { z } from "zod";

const projectBriefSchema = z.object({
    format: z.string(),
    genre: z.string(),
    durationMin: z.number().gte(0, 'Duration must be greater than 0'),
    tone: z.array(z.string()),
    audience: z.string(),
    storyIdea: z.string(),
})

export const projectCreationRequestSchema = z.object({
    title: z.string().max(100, 'Title must be less than 100 characters'),
    brief: projectBriefSchema,
})

export type ProjectCreationRequest = z.infer<typeof projectCreationRequestSchema>;