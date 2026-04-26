import { z } from "zod";

export const projectBriefSchema = z.object({
    format: z.string(),
    genre: z.string(),
    durationMin: z.number().gte(0, 'Duration must be greater than 0'),
    tone: z.array(z.string()),
    audience: z.string(),
    storyIdea: z.string(),
})

export const createProjectSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    brief: projectBriefSchema,
})

export const updateProjectSchema = z.object({
    title: z.string().min(1, 'Title is required'),
})

export const deleteProjectSchema = z.object({
    id: z.uuid('Invalid project id'),
    title: z.string().min(1, 'Title is required'),
})