import { z } from "zod"

export const feedbackTypeSchema = z.enum(["issue", "feature_request"])

export const feedbackMetadataSchema = z.object({
  pageUrl: z.string().max(2000).optional(),
  userAgent: z.string().max(1000).optional(),
  viewport: z
    .object({
      width: z.number().int().nonnegative(),
      height: z.number().int().nonnegative(),
    })
    .optional(),
})

export const createFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  content: z
    .string()
    .trim()
    .min(1, "Feedback content is required")
    .max(5000, "Feedback content must be at most 5000 characters"),
  projectId: z.uuid("Invalid project id").nullable().optional(),
  metadata: feedbackMetadataSchema.optional(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>
