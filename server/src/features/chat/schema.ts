import { z } from "zod";
import { UserModelMessage } from 'ai';

export const textPartSchema = z.object({
    type: z.literal('text'),
    text: z.string().min(1, 'Text is required'),
})

export const imagePartSchema = z.object({
    type: z.literal('image'),
    image: z.instanceof(URL),
})

export const filePartSchema = z.object({
    type: z.literal('file'),
    data: z.instanceof(URL),
    mediaType: z.string().min(1, 'Media type is required'),
})

export const userMessageSchema: z.ZodType<UserModelMessage> = z.object({
    role: z.literal('user'),
    content: z.array(z.union([textPartSchema, imagePartSchema, filePartSchema])),
})