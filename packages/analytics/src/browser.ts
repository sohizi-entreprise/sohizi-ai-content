import posthog from "posthog-js"
import type { ConfigDefaults } from "posthog-js"
import type { AnalyticsEventName, AnalyticsProperties } from "./events"

export type PostHogPublicConfig = {
  project: string
  apiHost: string
  apiVersion: string
}

let initialized = false
let enabled = false
let identifiedUserId: string | null = null
let lastPageview: string | null = null

export function enableAnalytics(config: PostHogPublicConfig): boolean {
  if (!config.project || !config.apiHost || !config.apiVersion) return false
  if (!initialized) {
    posthog.init(config.project, {
      api_host: config.apiHost,
      defaults: config.apiVersion as ConfigDefaults,
      persistence: "cookie",
      cross_subdomain_cookie: true,
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
    })
    initialized = true
  } else if (!enabled) {
    posthog.opt_in_capturing()
  }
  enabled = true
  return true
}

export function disableAnalytics(): void {
  enabled = false
  identifiedUserId = null
  lastPageview = null
  if (initialized) posthog.opt_out_capturing()
}

export function identifyAnalyticsUser(userId: string): void {
  if (!enabled || !userId || identifiedUserId === userId) return
  posthog.identify(userId)
  identifiedUserId = userId
}

export function resetAnalyticsUser(): void {
  identifiedUserId = null
  if (enabled) posthog.reset()
}

export function captureAnalyticsEvent<TName extends AnalyticsEventName>(
  name: TName,
  properties: AnalyticsProperties<TName>,
): void {
  if (!enabled) return
  posthog.capture(name, properties)
}

export function captureAnalyticsPageview(
  url: string,
  app: "site" | "web",
): void {
  if (!enabled || lastPageview === url) return
  lastPageview = url
  posthog.capture("$pageview", { $current_url: url, app })
}

export function isAnalyticsEnabled(): boolean {
  return enabled
}
