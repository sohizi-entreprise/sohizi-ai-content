import { z } from 'zod'

export const commandResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  action: z.string(),
  isPublic: z.boolean(),
  projectId: z.uuid().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type CommandResponse = z.infer<typeof commandResponseSchema>
