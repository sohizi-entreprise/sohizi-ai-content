import { readSentryConfig } from "./sentry-config"
import type { PublicEnv } from "./public-env"

export function readPublicEnvFromNitro(): PublicEnv {
  const siteUrl = process.env.SITE_URL
  const mediaCdnUrl = process.env.MEDIA_CDN_URL

  if (!siteUrl) {
    throw new Error("SITE_URL is not set")
  }
  if (!mediaCdnUrl) {
    throw new Error("MEDIA_CDN_URL is not set")
  }

  return {
    sentry: readSentryConfig(),
    siteUrl,
    mediaCdnUrl,
    posthogProject: process.env.POSTHOG_PROJECT ?? "",
    posthogApiHost: process.env.POSTHOG_API_HOST ?? "",
    posthogApiVersion: process.env.POSTHOG_API_VERSION ?? "",
  }
}
