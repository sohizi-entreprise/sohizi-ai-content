import type { SentryPublicConfig } from "./sentry-config"

export type PublicEnv = {
  sentry: SentryPublicConfig
  posthogProject: string
  posthogApiHost: string
  posthogApiVersion: string
  siteUrl: string
  mediaCdnUrl: string
}

let cache: PublicEnv | undefined

export function setPublicEnv(env: PublicEnv) {
  cache = env
}

export function getPublicEnv(): PublicEnv {
  if (!cache) {
    throw new Error("Public env has not been loaded")
  }
  return cache
}
