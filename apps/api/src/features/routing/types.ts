import type { SubmitPayload } from "@/features/media-engine/providers/type"
import type { VendorCircuitConfig, VendorRateLimit } from "@/type"

export type MediaRoute = {
  modelId: string
  vendorName: string
  apiName: string
  priority: number
  rpm: number
  burst: number
  maxConcurrency: number
  cooldownMs: number
  probeTtlMs: number
}

export type RouteDecision = {
  requestId: string
  modelId: string
  vendorName: string
  apiName: string
  mappedPayload: SubmitPayload
  cooldownMs: number
  probeTtlMs: number
}

export type StickyDecision = RouteDecision & {
  providerRequestId: string
}

export type AcquireReason =
  "ok" | "circuit_open" | "concurrency" | "rpm" | "unavailable"

export type AcquireResult =
  | { ok: true; reason: "ok"; retryAfterMs: 0 }
  | { ok: false; reason: Exclude<AcquireReason, "ok">; retryAfterMs: number }

export type ReleaseOutcome = "success" | "failure" | "none" | "submit_ok"

export type VendorLimits = VendorRateLimit &
  VendorCircuitConfig & {
    leaseTtlMs: number
  }
