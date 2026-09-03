import { z } from "zod"

export const commandResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  action: z.string(),
  isPublic: z.boolean(),
  visible: z.boolean(),
  projectId: z.uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CommandResponse = z.infer<typeof commandResponseSchema>

export const createCommandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9][a-z0-9-_]*$/i,
      "Name must be slash-friendly (letters, numbers, - or _)",
    ),
  action: z.string().trim().min(1),
  visible: z.boolean().optional().default(false),
})

export const updateCommandSchema = createCommandSchema.partial()
