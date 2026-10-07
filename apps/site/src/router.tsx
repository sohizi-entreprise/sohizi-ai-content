import { createRouter } from "@tanstack/react-router"
import * as Sentry from "@sentry/tanstackstart-react"
import { useEffect } from "react"
import {
  reportBrowserError,
  reportServerBoundaryError,
} from "./lib/sentry-client"
import { routeTree } from "./routeTree.gen"
import type { SentryPublicConfig } from "./lib/sentry-config"

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    defaultPreload: "intent",
    defaultNotFoundComponent: () => <div>Not found</div>,
    defaultErrorComponent: ({ error }) => <RouterError error={error} />,
  })

  if (!router.isServer) {
    const config = (
      window as Window & { __SOHIZI_SENTRY__?: SentryPublicConfig }
    ).__SOHIZI_SENTRY__
    if (config?.enabled) {
      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        tracesSampleRate: config.tracesSampleRate,
        integrations: [Sentry.tanstackRouterBrowserTracingIntegration(router)],
        dataCollection: {
          userInfo: false,
          cookies: false,
          httpHeaders: false,
          httpBodies: [],
          urlQueryParams: false,
          genAI: { inputs: false, outputs: false },
          databaseQueryData: false,
        },
      })
    }
  }

  return router
}

function RouterError({ error }: { error: Error }) {
  reportServerBoundaryError(error)
  useEffect(() => reportBrowserError(error), [error])
  return <div>Error: {error.message}</div>
}
