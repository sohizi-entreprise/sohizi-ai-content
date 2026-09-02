import { z } from 'zod'

const mediaPartSchema = z.object({
  type: z.enum(['image', 'video', 'audio', 'document']),
  url: z.url().min(1, 'Media url is required'),
  mediaType: z.string().min(1, 'Media type is required'),
})

const promptPartSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1, 'Text is required'),
  context: z.record(z.string(), z.string()).optional(),
})

const userMsgSchema = z.object({
  role: z.literal('user'),
  content: z.array(z.union([mediaPartSchema, promptPartSchema])),
})

export const chatCompletionRequestSchema = z.object({
  type: z.literal('chat-completion'),
  modelId: z.string().min(1, 'Model id is required'),
  prompt: userMsgSchema,
  conversationId: z.uuid('Invalid conversation id').nullable(),
})

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>
