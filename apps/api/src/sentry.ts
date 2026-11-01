import "dotenv/config"
import * as Sentry from "@sentry/bun"

const environment = process.env.SENTRY_ENVIRONMENT ?? "local"
if (!["local", "rc", "prod"].includes(environment)) {
  throw new Error(`Invalid SENTRY_ENVIRONMENT: ${environment}`)
}

export const sentryEnabled =
  environment !== "local" || process.env.SENTRY_LOCAL_ENABLED === "true"

const ENABLED_INTEGRATION_NAMES = new Set([
  "EventFilters",
  "FunctionToString",
  "LinkedErrors",
  "RequestData",
  "Console",
  "Http",
  "Fetch",
  "OnUncaughtException",
  "OnUnhandledRejection",
  "ContextLines",
  "Context",
  "Modules",
  "ProcessSession",
  "BunServer",
])

function parseSampleRateEnv(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback
  return parsed
}

const defaultTracesSampleRate = parseSampleRateEnv(
  process.env.SENTRY_TRACES_SAMPLE_RATE,
  environment === "prod" ? 0.1 : environment === "rc" ? 0.25 : 1,
)

const inngestTracesSampleRate = parseSampleRateEnv(
  process.env.SENTRY_INNGEST_SAMPLE_RATE,
  environment === "prod" ? 0.02 : environment === "rc" ? 0.1 : 1,
)

if (sentryEnabled) {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) throw new Error("SENTRY_DSN is required when Sentry is enabled")

  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    enableOpenTelemetrySetup: false,
    maxBreadcrumbs: 30,
    integrations: (defaults) =>
      defaults.filter((integration) =>
        ENABLED_INTEGRATION_NAMES.has(integration.name),
      ),
    tracesSampler: (samplingContext) => {
      const attrs = samplingContext.attributes ?? {}
      const method = String(
        attrs["http.request.method"] ??
          samplingContext.normalizedRequest?.method ??
          "",
      ).toUpperCase()
      const path = String(attrs["url.path"] ?? "")

      // Drop CORS preflight, HEAD probes, healthchecks, and Swagger UI noise
      if (method === "OPTIONS" || method === "HEAD") return 0
      if (path === "/" || path === "/docs" || path.startsWith("/docs/")) {
        return 0
      }

      // Throttle high-frequency Inngest polling / webhook spans
      if (path === "/api/inngest" || path.startsWith("/api/inngest/")) {
        return inngestTracesSampleRate
      }

      return samplingContext.inheritOrSampleWith(defaultTracesSampleRate)
    },
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: true,
    },
  })
}

export function isSentrySpanRecording(): boolean {
  if (!sentryEnabled) return false
  const activeSpan = Sentry.getActiveSpan()
  return Boolean(activeSpan?.isRecording())
}

export function setSentryHttpRoute(method: string, route: string): void {
  if (!sentryEnabled || !route) return
  const activeSpan = Sentry.getActiveSpan()
  if (!activeSpan) return
  const rootSpan = Sentry.getRootSpan(activeSpan)
  if (!rootSpan.isRecording()) return

  const normalizedMethod = method.toUpperCase()
  rootSpan.updateName(`${normalizedMethod} ${route}`)
  rootSpan.setAttributes({
    "http.route": route,
    "url.template": route,
    "sentry.segment.name.source": "route",
  })
}

export function setSentryHttpErrorStatus(status: number): void {
  if (!sentryEnabled) return
  const activeSpan = Sentry.getActiveSpan()
  if (!activeSpan) return
  const rootSpan = Sentry.getRootSpan(activeSpan)
  if (rootSpan.isRecording()) {
    Sentry.setHttpStatus(rootSpan, status)
  }
}

export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!sentryEnabled) return
  await Sentry.flush(timeoutMs)
}

export function captureUnexpectedError(
  error: unknown,
  tags: Record<string, string | undefined> = {},
): void {
  if (!sentryEnabled) {
    console.error("Unexpected error (Sentry disabled)", error)
    return
  }
  if (isExpectedCancellation(error)) return
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
