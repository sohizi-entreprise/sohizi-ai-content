export type SentryPublicConfig = {
  dsn: string
  environment: "local" | "rc" | "prod"
  release?: string
  enabled: boolean
  tracesSampleRate: number
}

export function readSentryConfig(): SentryPublicConfig {
  const environment = process.env.SENTRY_ENVIRONMENT ?? "local"
  if (
    environment !== "local" &&
    environment !== "rc" &&
    environment !== "prod"
  ) {
    throw new Error(`Invalid SENTRY_ENVIRONMENT: ${environment}`)
  }
  const enabled =
    environment !== "local" || process.env.SENTRY_LOCAL_ENABLED === "true"
  const dsn = process.env.SENTRY_DSN ?? ""
  if (enabled && !dsn)
    throw new Error("SENTRY_DSN is required when Sentry is enabled")

  return {
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE,
    enabled,
    tracesSampleRate: environment === "prod" ? 0.1 : 1,
  }
}
