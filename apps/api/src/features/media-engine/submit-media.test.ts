import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { MediaRateLimitError, MediaServiceUnavailableError, MediaSubmissionUnknownError } from "./providers/type"

const calls: string[] = []
const releases: Array<{ outcome: string; retryAfterMs?: number }> = []
let row: Record<string, unknown> | null = null
let submitError: Error = new MediaSubmissionUnknownError("socket closed")

mock.module("@/features/generation-request/repo", () => ({
  getGenerationRequest: async () => row,
}))

mock.module("./repo", () => ({
  saveMediaSelection: async () => {
    calls.push("save")
    return true
  },
  claimMediaSubmit: async () => {
    calls.push("claim")
    return true
  },
  patchRequestRouting: async () => {
    calls.push("patch")
  },
  markMediaSubmissionUnknown: async () => {
    calls.push("unknown")
  },
  clearMediaSelection: async () => {
    calls.push("clear")
  },
}))

mock.module("./providers/factory", () => ({
  createProvider: () => ({
    submitRequest: async () => {
      calls.push("submit")
      throw submitError
    },
  }),
}))

mock.module("./providers/utils", () => ({
  mapVendorPayload: async () => ({}),
}))

mock.module("@/features/capacity/router", () => ({
  tryAcquireCapacity: async () => ({
    ok: true,
    selection: {
      account: {
        id: "media-test:primary",
        providerName: "media-test",
        adapter: "wavespeed",
        credential: "secret",
        strategy: "priority",
        limits: {
          rpm: 60,
          burst: 60,
          maxConcurrency: 10,
          probeTtlMs: 30_000,
          cooldownMs: 15_000,
        },
      },
      binding: {
        providerName: "wavespeed",
        adapter: "wavespeed",
        apiName: "image",
        priority: 0,
      },
      lease: {
        poolId: "account:media-test:primary",
        holderId: "req",
        leaseId: "lease",
        epoch: 1,
        expiresAtMs: Date.now() + 60_000,
      },
    },
  }),
  releaseCapacityLease: async (
    _lease: unknown,
    outcome: string,
    options?: { retryAfterMs?: number },
  ) => {
    calls.push("release")
    releases.push({ outcome, retryAfterMs: options?.retryAfterMs })
    return { ok: true }
  },
  renewCapacityLease: async () => ({ ok: true }),
}))

import {
  registerProvider,
  unregisterProvider,
} from "@/features/capacity/registry"

const { submitMediaWithCapacity } = await import("./submit-media")

describe("media submit lifecycle", () => {
  beforeEach(() => {
    calls.length = 0
    releases.length = 0
    submitError = new MediaSubmissionUnknownError("socket closed")
    registerProvider({
      name: "media-test",
      adapter: "media-test",
      tasks: ["media"],
      strategy: "priority",
      accounts: [
        {
          id: "media-test:primary",
          limits: {
            rpm: 60,
            burst: 60,
            maxConcurrency: 10,
            probeTtlMs: 30_000,
            cooldownMs: 15_000,
          },
          credential: () => "secret",
        },
      ],
    })
  })

  afterEach(() => {
    unregisterProvider("media-test")
  })

  test("a crash after claim is not submitted again", async () => {
    row = {
      submitState: "submitting",
      capacityAccountId: "media-test:primary",
      capacityLease: {
        poolId: "account:media-test:primary",
        holderId: "req",
        leaseId: "lease",
        epoch: 1,
        expiresAtMs: 1,
      },
      providerRequestId: null,
      request: { routing: { apiName: "image" } },
      cancelRequestedAt: null,
      userLease: null,
    }
    await expect(
      submitMediaWithCapacity({
        requestId: "req",
        modelId: "model",
        payload: {} as never,
        leaseTtlMs: 60_000,
      }),
    ).rejects.toThrow("ambiguous")
    expect(calls).toEqual(["unknown"])
  })

  test("an ambiguous provider response keeps the lease", async () => {
    row = {
      submitState: null,
      capacityAccountId: null,
      capacityLease: null,
      providerRequestId: null,
      request: {},
      cancelRequestedAt: null,
      userLease: null,
    }
    await expect(
      submitMediaWithCapacity({
        requestId: "req",
        modelId: "model",
        payload: {} as never,
        leaseTtlMs: 60_000,
      }),
    ).rejects.toThrow("may have been sent")
    expect(calls).toEqual(["save", "claim", "submit", "unknown"])
  })

  test("a media 429 passes its retry hint to the release", async () => {
    submitError = new MediaRateLimitError("limited", undefined, 2_500)
    row = {
      submitState: null,
      capacityAccountId: null,
      capacityLease: null,
      providerRequestId: null,
      request: {},
      cancelRequestedAt: null,
      userLease: null,
    }
    await expect(
      submitMediaWithCapacity({
        requestId: "req",
        modelId: "model",
        payload: {} as never,
        leaseTtlMs: 60_000,
      }),
    ).rejects.toThrow("limited")
    expect(releases[0]).toEqual({
      outcome: "rate_limited",
      retryAfterMs: 2_500,
    })
  })

  test("a media server error does not use a retry hint", async () => {
    submitError = new MediaServiceUnavailableError("down")
    row = {
      submitState: null,
      capacityAccountId: null,
      capacityLease: null,
      providerRequestId: null,
      request: {},
      cancelRequestedAt: null,
      userLease: null,
    }
    await expect(
      submitMediaWithCapacity({
        requestId: "req",
        modelId: "model",
        payload: {} as never,
        leaseTtlMs: 60_000,
      }),
    ).rejects.toThrow("down")
    expect(releases[0]).toEqual({
      outcome: "rate_limited",
      retryAfterMs: undefined,
    })
  })
})
