import "dotenv/config"
import * as Sentry from "@sentry/bun"

const environment = process.env.SENTRY_ENVIRONMENT ?? "local"
if (!["local", "rc", "prod"].includes(environment)) {
  throw new Error(`Invalid SENTRY_ENVIRONMENT: ${environment}`)
}

export const sentryEnabled =
  environment !== "local" || process.env.SENTRY_LOCAL_ENABLED === "true"

if (sentryEnabled) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) throw new Error("SENTRY_DSN is required when Sentry is enabled")

  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: environment === "prod" ? 0.1 : 1,
    enableOpenTelemetrySetup: false,
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

export function captureUnexpectedError(
  error: unknown,
  tags: Record<string, string | undefined> = {},
): void {
  if (!sentryEnabled || isExpectedCancellation(error)) return
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(tags)) {
      if (value && value.length <= 128 && /^[\w./:{}-]+$/.test(value)) {
        scope.setTag(key, value)
      }
    }
    Sentry.captureException(error)
  })
}

function isExpectedCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const { name, code } = error as { name?: unknown; code?: unknown }
  return (
    name === "AbortError" ||
    name === "CanceledError" ||
    name === "CancelledError" ||
    code === "ABORT_ERR" ||
    code === "ERR_CANCELED"
  )
}

export function logSentryWarning(
  message: string,
  attributes: Record<string, string | number | boolean> = {},
): void {
  if (sentryEnabled) Sentry.logger.warn(message, attributes)
}
