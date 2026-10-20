export type LeaseHandle = {
  poolId: string
  holderId: string
  leaseId: string
  epoch: number
  expiresAtMs: number
}

export type LeaseLimits = {
  /** Unset or `<= 0` skips the token bucket. */
  rpm?: number
  burst?: number
  maxConcurrency: number
  leaseTtlMs: number
  probeTtlMs?: number
  cooldownMs?: number
}

export type AcquireRejectReason =
  "circuit_open" | "concurrency" | "rpm" | "unavailable"

export type AcquireResult =
  | { ok: true; lease: LeaseHandle; replay: boolean }
  | { ok: false; reason: AcquireRejectReason; retryAfterMs: number }

export type ReleaseOutcome =
  "completed" | "rate_limited" | "not_sent" | "abandoned"

export type LeaseMutationResult =
  | { ok: true; expiresAtMs?: number }
  | { ok: false; reason: "not_found" | "stale_lease" | "unavailable" }

export type CapacityTask =
  "web.search" | "web.extract" | "llm" | "media" | "video.export"

export type ErrorAction =
  | "account_failure"
  | "route_failure"
  | "client_failure"
  | "not_sent"
  | "submission_unknown"
  | "abort"
