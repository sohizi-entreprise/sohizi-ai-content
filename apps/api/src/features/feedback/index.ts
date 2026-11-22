import { Elysia } from "elysia"
import { authMiddleware } from "@/lib/auth-middleware"
import { createFeedbackSchema } from "./schema"
import { createFeedback } from "./repo"

export const feedbackRoutes = new Elysia({ prefix: "/feedback" })
  .use(authMiddleware)
  .post(
    "",
    async ({ body, user }) => {
      return createFeedback(user.id, body)
    },
    {
      body: createFeedbackSchema,
    },
  )
