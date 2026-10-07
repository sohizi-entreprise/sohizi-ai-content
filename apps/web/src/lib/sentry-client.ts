import * as Sentry from "@sentry/tanstackstart-react"

export function reportBrowserError(error: unknown): void {
  if (typeof window !== "undefined" && Sentry.isInitialized()) {
    Sentry.captureException(error)
  }
}

export function reportServerBoundaryError(error: unknown): void {
  if (typeof window === "undefined" && Sentry.isInitialized()) {
    Sentry.captureException(error)
  }
}
