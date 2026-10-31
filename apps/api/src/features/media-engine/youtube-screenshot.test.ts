import { afterEach, describe, expect, it, mock } from "bun:test"
import type { CapacityLeaseStore } from "@/features/capacity/lease-store"
import type { LeaseHandle, LeaseLimits } from "@/features/capacity/types"
import { captureYoutubeScreenshot } from "./youtube-screenshot"

const originalFetch = globalThis.fetch
const originalWorkerUrl = process.env.CLOUDFLARE_WORKER_URL
const originalToken = process.env.CLOUDFLARE_WORKER_TOKEN

function fakeStore() {
  const active = new Map<string, Set<string>>()
  const acquire = mock(
    async (poolId: string, holderId: string, limits: LeaseLimits) => {
      const holders = active.get(poolId) ?? new Set<string>()
      if (holders.size >= limits.maxConcurrency) {
        return {
          ok: false as const,
          reason: "concurrency" as const,
          retryAfterMs: 5_000,
        }
      }
      holders.add(holderId)
      active.set(poolId, holders)
      const lease: LeaseHandle = {
        poolId,
        holderId,
        leaseId: crypto.randomUUID(),
        epoch: 1,
        expiresAtMs: Date.now() + limits.leaseTtlMs,
      }
      return { ok: true as const, lease, replay: false }
    },
  )
  const release = mock(async (lease: LeaseHandle) => {
    active.get(lease.poolId)?.delete(lease.holderId)
    return { ok: true as const }
  })
  return {
    store: { acquire, release } as unknown as CapacityLeaseStore,
    active,
    acquire,
    release,
  }
}

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalWorkerUrl === undefined) delete process.env.CLOUDFLARE_WORKER_URL
  else process.env.CLOUDFLARE_WORKER_URL = originalWorkerUrl
  if (originalToken === undefined) delete process.env.CLOUDFLARE_WORKER_TOKEN
  else process.env.CLOUDFLARE_WORKER_TOKEN = originalToken
})

function configure() {
  process.env.CLOUDFLARE_WORKER_URL = "https://worker.example.com/"
  process.env.CLOUDFLARE_WORKER_TOKEN = "test-token"
}

const input = { youtubeUrl: "https://youtu.be/M7lc1UVf-VE?t=90" }

describe("YouTube screenshot API client capacity", () => {
  it("sends the server token after acquiring both leases and releases them", async () => {
    configure()
    const { store, active, acquire, release } = fakeStore()
    const fetchMock = mock(async () =>
      Response.json({
        id: "capture-id",
        url: "https://media.example.com/youtube_extractions/capture-id.png",
        requestedSeconds: 90,
        capturedSeconds: 90.1,
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const response = await captureYoutubeScreenshot(input, "user-1", store)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: "capture-id" })
    expect(acquire).toHaveBeenCalledTimes(2)
    expect(release).toHaveBeenCalledTimes(2)
    expect([...active.values()].every((holders) => holders.size === 0)).toBe(
      true,
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example.com/v1/youtube-screenshots",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
      }),
    )
  })

  it("allows only one active screenshot per user across requests", async () => {
    configure()
    const { store, active } = fakeStore()
    let finish!: (response: Response) => void
    const fetchMock = mock(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    globalThis.fetch = fetchMock as typeof fetch
    const first = captureYoutubeScreenshot(input, "user-1", store)
    for (let i = 0; i < 100 && fetchMock.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const second = await captureYoutubeScreenshot(input, "user-1", store)
    expect(second.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    finish(Response.json({ id: "capture-id" }))
    expect((await first).status).toBe(200)
    expect([...active.values()].every((holders) => holders.size === 0)).toBe(
      true,
    )
  })

  it("enforces the shared service cap for different users", async () => {
    configure()
    const { store, active } = fakeStore()
    const finish: Array<(response: Response) => void> = []
    const fetchMock = mock(
      () =>
        new Promise<Response>((resolve) => {
          finish.push(resolve)
        }),
    )
    globalThis.fetch = fetchMock as typeof fetch
    const pending = Array.from({ length: 10 }, (_, i) =>
      captureYoutubeScreenshot(input, `user-${i}`, store),
    )
    for (let i = 0; i < 100 && fetchMock.mock.calls.length < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    expect(fetchMock).toHaveBeenCalledTimes(10)
    const extra = await captureYoutubeScreenshot(input, "user-11", store)
    expect(extra.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    finish.forEach((resolve) => resolve(Response.json({ id: "capture-id" })))
    expect(
      (await Promise.all(pending)).every((response) => response.status === 200),
    ).toBe(true)
    expect([...active.values()].every((holders) => holders.size === 0)).toBe(
      true,
    )
  })

  it("returns a retryable Worker rate limit and releases leases", async () => {
    configure()
    const { store, active, release } = fakeStore()
    globalThis.fetch = mock(async () =>
      Response.json(
        { error: "internal browser details" },
        { status: 429, headers: { "Retry-After": "7" } },
      ),
    ) as typeof fetch
    const response = await captureYoutubeScreenshot(input, "user-1", store)
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("7")
    expect(await response.text()).not.toContain("internal browser details")
    expect(release).toHaveBeenCalledTimes(2)
    expect([...active.values()].every((holders) => holders.size === 0)).toBe(
      true,
    )
  })

  it("releases both leases after a network failure", async () => {
    configure()
    const { store, active } = fakeStore()
    globalThis.fetch = mock(async () => {
      throw new Error("network down")
    }) as typeof fetch
    const response = await captureYoutubeScreenshot(input, "user-1", store)
    expect(response.status).toBe(502)
    expect([...active.values()].every((holders) => holders.size === 0)).toBe(
      true,
    )
  })
})
