import {
  describe,
  expect,
  test,
  beforeAll,
  afterAll,
  beforeEach,
} from "bun:test"
import { randomUUID } from "node:crypto"
import { db } from "@/db"
import { llmModels, llmVendors, llmVendorsAndModels } from "@/db/schema"
import { eq, like } from "drizzle-orm"
import { redis } from "@/lib/redis"
import {
  createProvider,
  registerMediaProvider,
  unregisterMediaProvider,
} from "@/features/media-engine/providers/factory"
import {
  MediaRateLimitError,
  MediaValidationError,
} from "@/features/media-engine/errors"
import { VendorLimiter } from "../limiter"
import {
  pollWithSticky,
  resolveAndAcquire,
  submitWithFailover,
} from "../router"
import { AllVendorsSaturatedError, NoRouteError } from "../errors"
import {
  createFakeProviderClass,
  fakePollCount,
  fakeSubmitCount,
  resetFakeVendors,
  setFakeScript,
} from "./fake-provider"

const PREFIX = `rtroute-${randomUUID().slice(0, 8)}`
const FAKE_A = `${PREFIX}-a`
const FAKE_B = `${PREFIX}-b`
const MODEL = `${PREFIX}-model`

let limiter: VendorLimiter
let prefix: string
const ids = { a: "", b: "" }

const identityMap = async (
  _vendor: string,
  _model: string,
  payload: Record<string, unknown>,
) => payload

beforeAll(async () => {
  process.env[`${FAKE_A.toUpperCase().replace(/-/g, "_")}_API_KEY`] = "test"
  process.env[`${FAKE_B.toUpperCase().replace(/-/g, "_")}_API_KEY`] = "test"
  registerMediaProvider(FAKE_A, createFakeProviderClass(FAKE_A))
  registerMediaProvider(FAKE_B, createFakeProviderClass(FAKE_B))

  await db.insert(llmModels).values({
    id: MODEL,
    provider: "test",
    name: "Router test model",
    enabled: true,
  })
  const [a] = await db
    .insert(llmVendors)
    .values({
      name: FAKE_A,
      kind: "media",
      enabled: true,
      rateLimit: { rpm: 60, burst: 60, maxConcurrency: 2 },
    })
    .returning()
  const [b] = await db
    .insert(llmVendors)
    .values({
      name: FAKE_B,
      kind: "media",
      enabled: true,
      rateLimit: { rpm: 60, burst: 60, maxConcurrency: 2 },
    })
    .returning()
  ids.a = a.id
  ids.b = b.id
  await db.insert(llmVendorsAndModels).values([
    {
      vendorId: a.id,
      modelId: MODEL,
      apiName: "api-a",
      enabled: true,
      priority: 10,
    },
    {
      vendorId: b.id,
      modelId: MODEL,
      apiName: "api-b",
      enabled: true,
      priority: 20,
    },
  ])
})

afterAll(async () => {
  await db
    .delete(llmVendorsAndModels)
    .where(eq(llmVendorsAndModels.modelId, MODEL))
  await db.delete(llmVendors).where(like(llmVendors.name, `${PREFIX}%`))
  await db.delete(llmModels).where(eq(llmModels.id, MODEL))
  unregisterMediaProvider(FAKE_A)
  unregisterMediaProvider(FAKE_B)
})

beforeEach(async () => {
  prefix = `test:${randomUUID()}:`
  limiter = new VendorLimiter({
    redis,
    keyPrefix: prefix,
    acquireTimeoutMs: 500,
  })
  await limiter.deleteKeys(FAKE_A)
  await limiter.deleteKeys(FAKE_B)
  resetFakeVendors()
})

const resolveOpts = (requestId: string, extra?: Record<string, unknown>) => ({
  modelId: MODEL,
  requestId,
  payload: { prompt: "hi" },
  leaseTtlMs: 60_000,
  limiter,
  mapPayload:
    identityMap as typeof import("@/features/media-engine/providers/utils").mapVendorPayload,
  createProvider,
  ...extra,
})

describe("resolveAndAcquire", () => {
  test("acquires the highest-priority vendor", async () => {
    const decision = await resolveAndAcquire(resolveOpts("r1"))
    expect(decision.vendorName).toBe(FAKE_A)
    expect(decision.apiName).toBe("api-a")
    expect(decision.mappedPayload).toEqual({ prompt: "hi" })
    await limiter.release(FAKE_A, "r1", { outcome: "none" })
  })

  test("skips a saturated preferred vendor", async () => {
    expect(
      (
        await limiter.acquire(FAKE_A, "fill-1", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    expect(
      (
        await limiter.acquire(FAKE_A, "fill-2", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    const decision = await resolveAndAcquire(resolveOpts("r-next"))
    expect(decision.vendorName).toBe(FAKE_B)
    await limiter.release(FAKE_A, "fill-1", { outcome: "none" })
    await limiter.release(FAKE_A, "fill-2", { outcome: "none" })
    await limiter.release(FAKE_B, "r-next", { outcome: "none" })
  })

  test("skips a circuit-open preferred vendor", async () => {
    expect(
      (
        await limiter.acquire(FAKE_A, "seed", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    await limiter.release(FAKE_A, "seed", {
      outcome: "failure",
      retryAfterMs: 10_000,
      cooldownMs: 10_000,
    })
    const decision = await resolveAndAcquire(resolveOpts("r-fb"))
    expect(decision.vendorName).toBe(FAKE_B)
    await limiter.release(FAKE_B, "r-fb", { outcome: "none" })
  })

  test("exclude skips a vendor", async () => {
    const decision = await resolveAndAcquire(
      resolveOpts("r-ex", { exclude: [FAKE_A] }),
    )
    expect(decision.vendorName).toBe(FAKE_B)
    await limiter.release(FAKE_B, "r-ex", { outcome: "none" })
  })

  test("throws NoRouteError when the model has no media routes", async () => {
    await expect(
      resolveAndAcquire(
        resolveOpts("r-none", { modelId: `${PREFIX}-missing` }),
      ),
    ).rejects.toBeInstanceOf(NoRouteError)
  })

  test("throws AllVendorsSaturatedError when every vendor rejects", async () => {
    expect(
      (
        await limiter.acquire(FAKE_A, "a1", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    expect(
      (
        await limiter.acquire(FAKE_A, "a2", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    expect(
      (
        await limiter.acquire(FAKE_B, "b1", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    expect(
      (
        await limiter.acquire(FAKE_B, "b2", {
          rpm: 60,
          burst: 60,
          maxConcurrency: 2,
          leaseTtlMs: 60_000,
        })
      ).ok,
    ).toBe(true)
    await expect(
      resolveAndAcquire(resolveOpts("r-sat")),
    ).rejects.toBeInstanceOf(AllVendorsSaturatedError)
    await limiter.release(FAKE_A, "a1", { outcome: "none" })
    await limiter.release(FAKE_A, "a2", { outcome: "none" })
    await limiter.release(FAKE_B, "b1", { outcome: "none" })
    await limiter.release(FAKE_B, "b2", { outcome: "none" })
  })
})

describe("submitWithFailover", () => {
  test("fails over on rate limit to the next vendor", async () => {
    setFakeScript(FAKE_A, {
      submitError: new MediaRateLimitError("429", undefined, 1000),
    })
    setFakeScript(FAKE_B, {
      submit: async () => ({ requestId: "job-b", status: "created" }),
    })
    const sticky = await submitWithFailover(resolveOpts("r-fo"))
    expect(sticky.vendorName).toBe(FAKE_B)
    expect(sticky.providerRequestId).toBe("job-b")
    expect(fakeSubmitCount(FAKE_A)).toBe(1)
    expect(fakeSubmitCount(FAKE_B)).toBe(1)
    expect(await limiter.inflightCount(FAKE_A)).toBe(0)
    expect(await limiter.inflightCount(FAKE_B)).toBe(1)
    await limiter.release(FAKE_B, "r-fo", { outcome: "none" })
  })

  test("does not fail over on validation errors and releases the slot", async () => {
    setFakeScript(FAKE_A, {
      submitError: new MediaValidationError("bad payload"),
    })
    await expect(
      submitWithFailover(resolveOpts("r-val")),
    ).rejects.toBeInstanceOf(MediaValidationError)
    expect(fakeSubmitCount(FAKE_B)).toBe(0)
    expect(await limiter.inflightCount(FAKE_A)).toBe(0)
  })

  test("poll hits only the sticky vendor", async () => {
    setFakeScript(FAKE_A, {
      submit: async () => ({ requestId: "job-a", status: "created" }),
    })
    const sticky = await submitWithFailover(resolveOpts("r-st"))
    await pollWithSticky(sticky)
    expect(fakePollCount(FAKE_A)).toBe(1)
    expect(fakePollCount(FAKE_B)).toBe(0)
    await limiter.release(FAKE_A, "r-st", { outcome: "none" })
  })

  test("replay after acquire does not take a second slot", async () => {
    setFakeScript(FAKE_A, {
      submit: async () => ({ requestId: "job-a", status: "created" }),
    })
    const first = await resolveAndAcquire(resolveOpts("r-rep"))
    expect(first.vendorName).toBe(FAKE_A)
    const again = await resolveAndAcquire(resolveOpts("r-rep"))
    expect(again.vendorName).toBe(FAKE_A)
    expect(await limiter.inflightCount(FAKE_A)).toBe(1)
    await limiter.release(FAKE_A, "r-rep", { outcome: "none" })
  })
})
