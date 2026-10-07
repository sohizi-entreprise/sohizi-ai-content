import "./instrumentation"
import { captureUnexpectedError } from "./sentry"
import { Elysia } from "elysia"
import { swagger } from "@elysiajs/swagger"
import * as routes from "./features"
import * as errors from "./features/error"
import { cors } from "@elysiajs/cors"
import { inngest, functions } from "@/lib/inngest"
import { serve } from "inngest/bun"
import { auth } from "@/lib/auth"
import { analyticsConsentRoutes } from "@/features/analytics-consent"
import { billingService, InsufficientCreditsError } from "@/features/billing"
import { NameConflictError } from "@/features/skill-market"

const corsConfig = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL?.replace("//app.", "//www."),
  ].filter((value): value is string => Boolean(value)),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Last-Event-ID",
    "Accept",
    "Cache-Control",
    "sentry-trace",
    "baggage",
  ],
  credentials: true,
}

const betterAuthPlugin = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers })
        if (!session) return status(401)
        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

const handler = serve({
  client: inngest,
  functions,
})

const inngestHandler = new Elysia().all(
  "/api/inngest",
  ({ request }: { request: Request }) => handler(request),
)

const app = new Elysia()
  .use(cors(corsConfig))
  .use(betterAuthPlugin)
  .error({ ...errors, InsufficientCreditsError, NameConflictError })
  .onError(({ code, error, request, route }) => {
    const url = new URL(request.url)
    switch (code) {
      case "BadRequest":
      case "Conflict":
      case "Forbidden":
      case "Unauthorized":
      case "NotFound":
        return error instanceof errors.BadRequest ||
          error instanceof errors.Conflict ||
          error instanceof errors.Forbidden ||
          error instanceof errors.Unauthorized ||
          error instanceof errors.NotFound
          ? error.toResponse()
          : error
      case "InsufficientCreditsError":
        return (error as InsufficientCreditsError).toResponse()
      case "NameConflictError":
        return (error as NameConflictError).toResponse()
      case "InternalServerError":
        captureUnexpectedError(error, {
          service: "api",
          route,
          method: request.method,
          error_code: String(code),
          request_id: request.headers.get("x-request-id") ?? undefined,
        })
        return error instanceof errors.InternalServerError
          ? error.toResponse()
          : error
      case "VALIDATION":
        return new errors.BadRequest(error.message)
      default:
        captureUnexpectedError(error, {
          service: "api",
          route,
          method: request.method,
          error_code: String(code),
          request_id: request.headers.get("x-request-id") ?? undefined,
        })
        console.error(`[${code}] ${request.method} ${url.pathname}\n`, error)
        return Response.json(
          {
            error: "Oops! Something went wrong.",
            code: 500,
          },
          {
            status: 500,
          },
        )
    }
  })
  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: { title: "My API", version: "1.0.0" },
        tags: [{ name: "greeting", description: "Greeting endpoints" }],
      },
    }),
  )
  .use(inngestHandler)
  .get("/", () => "Welcome to Sohizi Labs API")
  .use(analyticsConsentRoutes)
  .use(routes.projectRoutes)
  .use(routes.fileSystemRoutes)
  .use(routes.chatRoutes)
  .use(routes.mediaEngineRoutes)
  .use(routes.billingRoutes)
  .use(routes.videoEditorRoutes)
  .use(routes.generationRequestRoutes)
  .use(routes.commandRoutes)
  .use(routes.modelsRoutes)
  .use(routes.skillMarketRoutes)
  .use(routes.adminRoutes)
  .listen({
    port: 3030,
    hostname: "0.0.0.0",
  })

billingService.startSweeper()

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
