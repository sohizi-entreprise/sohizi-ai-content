import api from "@/lib/axios"
import { throwApiError } from "@/lib/errors"

export type FeedbackType = "issue" | "feature_request"

export type FeedbackMetadata = {
  pageUrl?: string
  userAgent?: string
  viewport?: {
    width: number
    height: number
  }
}

export type SubmitFeedbackInput = {
  type: FeedbackType
  content: string
  projectId?: string | null
  metadata?: FeedbackMetadata
}

export type FeedbackResponse = {
  id: string
  userId: string
  projectId: string | null
  type: FeedbackType
  content: string
  status: string
  metadata: FeedbackMetadata | null
  createdAt: string
  updatedAt: string
}

export const submitFeedback = async (
  input: SubmitFeedbackInput,
): Promise<FeedbackResponse> => {
  try {
    const response = await api.post<FeedbackResponse>("/feedback", input)
    return response.data
  } catch (error) {
    throwApiError(error, "Failed to submit feedback")
  }
}
