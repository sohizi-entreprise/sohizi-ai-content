import { db } from "@/db"
import { feedbacks } from "@/db/schema"
import type { CreateFeedbackInput } from "./schema"

export const createFeedback = async (
  userId: string,
  input: CreateFeedbackInput,
) => {
  const [created] = await db
    .insert(feedbacks)
    .values({
      userId,
      projectId: input.projectId ?? null,
      type: input.type,
      content: input.content,
      status: "open",
      metadata: input.metadata ?? null,
    })
    .returning()

  return created
}
