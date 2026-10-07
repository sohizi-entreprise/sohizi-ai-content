import { readSentryConfig } from "./sentry-config"
import type { PublicEnv } from "./public-env"

export function readPublicEnvFromNitro(): PublicEnv {
  const appUrl = process.env.APP_URL

  if (!appUrl) {
    throw new Error("APP_URL is not set")
  }

  return {
    sentry: readSentryConfig(),
    appUrl,
    posthogProject: process.env.POSTHOG_PROJECT ?? "",
    posthogApiHost: process.env.POSTHOG_API_HOST ?? "",
    posthogApiVersion: process.env.POSTHOG_API_VERSION ?? "",
  }
}
