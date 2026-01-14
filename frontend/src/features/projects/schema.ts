import { z } from 'zod'

const PROJECT_FORMATS = ["storytime", "explainer", "documentary", "presenter"] as const

export const CreateProject = z.object({
    name: z.string().min(1, 'Project name is required'),
    format: z.enum(PROJECT_FORMATS),
    language: z.string().default('en'),
    audience: z.enum(['general', 'kids', 'teens', 'adult']),
    tone: z.string().min(1, 'Tone is required'),
    genre: z.string(),
    initialInput: z.union([
      z.object({
        type: z.literal('prompt'),
        content: z.string(),
      }),
      z.object({
        type: z.literal('file'),
        content: z.string(),
      }),
    ]),
    constraints: z.object({
      mustInclude: z.array(z.string()),
      mustAvoid: z.array(z.string()),
      forbiddenPhrases: z.array(z.string()),
    }).optional(),
  })

export const UpdateProject = z.object({
    name: z.string().min(1, 'Project name is required'),
})