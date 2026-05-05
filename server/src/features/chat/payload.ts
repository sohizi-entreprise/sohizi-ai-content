import { z } from "zod";

export const CompletionRequestSchema = z.object({
    modelId: z.string().min(1, 'Model id is required'),
    userPrompt: z.string().min(1, 'User prompt is required'),
    conversationId: z.uuid('Invalid conversation id').nullable(),
    editorContext: z.record(z.string(), z.any()).optional(),
})

export type CompletionRequest = z.infer<typeof CompletionRequestSchema>;