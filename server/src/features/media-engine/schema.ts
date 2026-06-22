import { z } from 'zod'

export const getUploadUrlSchema = z.object({
    projectId: z.uuid(),
    fileName: z.string().min(1),
    contentType: z.string().min(1),
})

export const uploadSuccessSchema = z.object({
    projectId: z.uuid(),
    folderId: z.uuid(),
    storageKey: z.string().min(1)
})

export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>
