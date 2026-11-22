import { z } from "zod"

export const commandResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  promptModifier: z.string(),
  sortOrder: z.number(),
  enabled: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CommandResponse = z.infer<typeof commandResponseSchema>

export const createCommandSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-_]*$/i,
      "ID must be slash-friendly (letters, numbers, - or _)",
    ),
  name: z.string().trim().min(1).max(100),
  promptModifier: z.string().trim().min(1),
  enabled: z.boolean().optional().default(true),
})

export const updateCommandSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  promptModifier: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional(),
})
