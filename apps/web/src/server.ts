import * as Sentry from "@sentry/tanstackstart-react"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { readSentryConfig } from "./lib/sentry-config"

const config = readSentryConfig()
if (config.enabled) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: config.release,
    tracesSampleRate: config.tracesSampleRate,
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

export default createServerEntry(
  Sentry.wrapFetchWithSentry({
    fetch(request) {
      return handler.fetch(request)
    },
  }),
)
