import { Elysia } from "elysia";
import { openapi } from '@elysiajs/openapi'
import { swagger } from '@elysiajs/swagger'
import * as routes from './features'
import * as errors from './features/error'
import { cors } from '@elysiajs/cors'

const corsConfig = {
  origin: ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}


const app = new Elysia()
                .use(cors(corsConfig))
                .error({...errors})
                .onError(({code, error, request})=>{
                  const url = new URL(request.url)
                  switch(code){
                    case "BadRequest":
                    case "Forbidden":
                    case "Unauthorized":
                    case "NotFound":
                    case "InternalServerError":
                      return error
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
                    path: '/docs',                       // Swagger UI URL (default: /swagger)
                    documentation: {
                      info: { title: 'My API', version: '1.0.0' },
                      tags: [{ name: 'greeting', description: 'Greeting endpoints' }],
                    },
                  })
                )
                .get("/", () => "Welcome to Sohizi AI content")
                .use(routes.projectRoutes)
                .use(routes.aiRoutes)
                .use(routes.streamRoutes)
                .listen(3030);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
