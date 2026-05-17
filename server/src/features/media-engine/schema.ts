import { z } from 'zod'

const imageSizePresets = ['auto', 'square', 'landscape', 'portrait', '2k-square', '2k-landscape', '4k-landscape', '4k-portrait'] as const;

export const generateImageSchema = z.object({
    projectId: z.uuid(),
    prompt: z.string().min(1),
    model: z.string().min(1),
    aspectRatio: z.enum(imageSizePresets).default('auto'),
    referenceImages: z.array(z.string().url()).optional(),
    numVariations: z.number().int().min(1).max(4).default(1),
})

export const generateAudioSchema = z.object({
    projectId: z.uuid(),
    prompt: z.string().min(1),
    audioType: z.enum(['speech', 'sound-effect', 'music', 'dialogue']),
})

export const generateVideoSchema = z.object({
    projectId: z.uuid(),
    prompt: z.string().min(1),
    model: z.string().min(1),
    duration: z.number().min(1).max(60),
    aspectRatio: z.enum(['16:9', '9:16', '1:1']).default('16:9'),
    referenceImage: z.url().optional(),
})

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

export const projectIdParamSchema = z.object({
    projectId: z.uuid('Invalid project id'),
})

export type GenerateImageInput = z.infer<typeof generateImageSchema>
export type GenerateAudioInput = z.infer<typeof generateAudioSchema>
export type GenerateVideoInput = z.infer<typeof generateVideoSchema>
export type GetUploadUrlInput = z.infer<typeof getUploadUrlSchema>
