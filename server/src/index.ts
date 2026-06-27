import { Elysia } from "elysia";
import { swagger } from '@elysiajs/swagger'
import * as routes from './features'
import * as errors from './features/error'
import { cors } from '@elysiajs/cors'
import { inngest, functions } from "@/lib/inngest";
import { serve } from "inngest/bun";
import { auth } from "@/lib/auth";
import { billingService, InsufficientCreditsError } from "@/features/billing";


// 2. Set the global to false BEFORE importing your AI logic
globalThis.AI_SDK_LOG_WARNINGS = false;

const corsConfig = {
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Last-Event-ID', 'Accept', 'Cache-Control'],
  credentials: true,
}

const betterAuthPlugin = new Elysia({ name: "better-auth" })
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({ headers });
        if (!session) return status(401);
        return {
          user: session.user,
          session: session.session,
        };
      },
    },
  });

const handler = serve({
  client: inngest,
  functions,
});

const inngestHandler = new Elysia().all("/api/inngest", ({ request }: { request: Request }) =>
  handler(request)
);


const app = new Elysia()
                .use(cors(corsConfig))
                .use(betterAuthPlugin)
                .error({...errors, InsufficientCreditsError})
                .onError(({code, error, request})=>{
                  const url = new URL(request.url)
                  switch(code){
                    case "BadRequest":
                    case "Conflict":
                    case "Forbidden":
                    case "Unauthorized":
                    case "NotFound":
                    case "InternalServerError":
                      return error
                    case "InsufficientCreditsError":
                      return (error as InsufficientCreditsError).toResponse()
                    case "VALIDATION":
                      return new errors.BadRequest(error.message)
                    default:
                      console.error(`[${code}] ${request.method} ${url.pathname}\n`, error)
                      return Response.json({
                        error: "Oops! Something went wrong.",
                        code: 500,
                      }, {
                        status: 500,
                      })
                  }
                })
                .use(
                  swagger({
                    path: '/docs',
                    documentation: {
                      info: { title: 'My API', version: '1.0.0' },
                      tags: [{ name: 'greeting', description: 'Greeting endpoints' }],
                    },
                  })
                )
                .use(inngestHandler)
                .get("/", () => "Welcome to Sohizi AI content")
                .use(routes.projectRoutes)
                .use(routes.aiRoutes)
                .use(routes.fileSystemRoutes)
                .use(routes.chatRoutes)
                .use(routes.mediaEngineRoutes)
                .use(routes.billingRoutes)
                .use(routes.videoEditorRoutes)
                .use(routes.generationRequestRoutes)
                .listen(3030);

billingService.startSweeper();

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
