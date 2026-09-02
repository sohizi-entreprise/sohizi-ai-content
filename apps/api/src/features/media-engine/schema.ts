import { z } from 'zod'

export const getUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
})

export const uploadSuccessSchema = z.object({
  folderId: z.uuid().nullable(),
  storageKey: z.string().min(1),
})

export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>
