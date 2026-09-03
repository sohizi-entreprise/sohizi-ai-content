import { Elysia, t } from "elysia"
import * as service from "./service"
import { chatCompletionRequestSchema } from "./schema"
import { assertProjectAccess } from "@/lib/authorize"
import { authMiddleware } from "@/lib/auth-middleware"

export const generationRequestRoutes = new Elysia({ prefix: "/generations" })
  .use(authMiddleware)
  .post(
    "/chat-completion/:projectId",
    async ({ params, body, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return service.handleChatCompletionRequest(
        body,
        user.id,
        params.projectId,
      )
    },
    {
      body: chatCompletionRequestSchema,
      params: t.Object({ projectId: t.String({ format: "uuid" }) }),
    },
  )
  .post(
    "/cancel/:projectId/:requestId",
    async ({ params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return service.cancelRequest(params.projectId, user.id, params.requestId)
    },
    {
      params: t.Object({
        projectId: t.String({ format: "uuid" }),
        requestId: t.String({ format: "uuid" }),
      }),
    },
  )
  .get(
    "/pending/:projectId",
    async ({ params, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return service.listPendingRequests(params.projectId, user.id)
    },
    {
      params: t.Object({ projectId: t.String({ format: "uuid" }) }),
    },
  )
  .post(
    "/statuses/:projectId",
    async ({ params, body, user }) => {
      await assertProjectAccess(user.id, params.projectId)
      return service.getRequestStatuses(params.projectId, body)
    },
    {
      body: t.Object({ requestIds: t.Array(t.String()) }),
      params: t.Object({ projectId: t.String({ format: "uuid" }) }),
    },
  )
  .get(
    "/stream/:projectId",
    async function* ({ params, set, request, user }) {
      await assertProjectAccess(user.id, params.projectId)

      set.headers["Cache-Control"] = "no-cache"
      set.headers["Connection"] = "keep-alive"
      set.headers["X-Accel-Buffering"] = "no"

      const lastEventIdsHeader = request.headers.get("last-event-id")
      let lastEventIds: Record<string, string> | undefined
      if (lastEventIdsHeader) {
        try {
          lastEventIds = JSON.parse(lastEventIdsHeader)
        } catch {
          // single ID fallback — ignored for multi-stream
        }
      }

      yield* service.streamActiveRequestsSSE(user.id, lastEventIds)
    },
    {
      params: t.Object({ projectId: t.String({ format: "uuid" }) }),
    },
  )
