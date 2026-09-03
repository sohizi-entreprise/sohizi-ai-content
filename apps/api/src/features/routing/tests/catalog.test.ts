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
import { DEFAULT_VENDOR_RATE_LIMIT } from "@/type"
import {
  registerMediaProvider,
  unregisterMediaProvider,
} from "@/features/media-engine/providers/factory"
import { listMediaRoutes } from "../catalog"
import { createFakeProviderClass } from "./fake-provider"

const PREFIX = `rtcat-${randomUUID().slice(0, 8)}`
const FAKE_A = `${PREFIX}-fake-a`
const FAKE_B = `${PREFIX}-fake-b`
const UNREGISTERED = `${PREFIX}-unknown`
const LLM_VENDOR = `${PREFIX}-openrouter`
const MODEL = `${PREFIX}-model`

const ids = {
  fakeA: "",
  fakeB: "",
  unregistered: "",
  llm: "",
}

beforeAll(async () => {
  process.env[`${FAKE_A.toUpperCase().replace(/-/g, "_")}_API_KEY`] = "test"
  process.env[`${FAKE_B.toUpperCase().replace(/-/g, "_")}_API_KEY`] = "test"

  registerMediaProvider(FAKE_A, createFakeProviderClass(FAKE_A))
  registerMediaProvider(FAKE_B, createFakeProviderClass(FAKE_B))

  await db.insert(llmModels).values({
    id: MODEL,
    provider: "test",
    name: "Catalog test model",
    enabled: true,
  })

  const [fakeA] = await db
    .insert(llmVendors)
    .values({
      name: FAKE_A,
      kind: "media",
      enabled: true,
      rateLimit: DEFAULT_VENDOR_RATE_LIMIT,
    })
    .returning()
  const [fakeB] = await db
    .insert(llmVendors)
    .values({
      name: FAKE_B,
      kind: "media",
      enabled: true,
      rateLimit: DEFAULT_VENDOR_RATE_LIMIT,
    })
    .returning()
  const [unknown] = await db
    .insert(llmVendors)
    .values({
      name: UNREGISTERED,
      kind: "media",
      enabled: true,
      rateLimit: DEFAULT_VENDOR_RATE_LIMIT,
    })
    .returning()
  const [llm] = await db
    .insert(llmVendors)
    .values({
      name: LLM_VENDOR,
      kind: "llm",
      enabled: true,
      rateLimit: DEFAULT_VENDOR_RATE_LIMIT,
    })
    .returning()

  ids.fakeA = fakeA.id
  ids.fakeB = fakeB.id
  ids.unregistered = unknown.id
  ids.llm = llm.id

  await db.insert(llmVendorsAndModels).values([
    {
      vendorId: fakeA.id,
      modelId: MODEL,
      apiName: "api-a",
      enabled: true,
      priority: 50,
    },
    {
      vendorId: fakeB.id,
      modelId: MODEL,
      apiName: "api-b",
      enabled: true,
      priority: 10,
    },
    {
      vendorId: unknown.id,
      modelId: MODEL,
      apiName: "api-x",
      enabled: true,
      priority: 1,
    },
    {
      vendorId: llm.id,
      modelId: MODEL,
      apiName: "api-llm",
      enabled: true,
      priority: 1,
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

describe("listMediaRoutes", () => {
  beforeEach(async () => {
    await db
      .update(llmModels)
      .set({ enabled: true })
      .where(eq(llmModels.id, MODEL))
    await db
      .update(llmVendors)
      .set({ enabled: true })
      .where(eq(llmVendors.id, ids.fakeA))
    await db
      .update(llmVendorsAndModels)
      .set({ enabled: true })
      .where(eq(llmVendorsAndModels.vendorId, ids.fakeA))
  })

  test("returns enabled media bindings with apiName and priority", async () => {
    const routes = await listMediaRoutes(MODEL)
    expect(routes.map((r) => r.vendorName)).toEqual([FAKE_B, FAKE_A])
    expect(routes[0]?.apiName).toBe("api-b")
    expect(routes[0]?.priority).toBe(10)
    expect(routes[1]?.apiName).toBe("api-a")
    expect(routes[1]?.priority).toBe(50)
  })

  test("skips disabled model", async () => {
    await db
      .update(llmModels)
      .set({ enabled: false })
      .where(eq(llmModels.id, MODEL))
    expect(await listMediaRoutes(MODEL)).toEqual([])
  })

  test("skips disabled vendor", async () => {
    await db
      .update(llmVendors)
      .set({ enabled: false })
      .where(eq(llmVendors.id, ids.fakeA))
    const names = (await listMediaRoutes(MODEL)).map((r) => r.vendorName)
    expect(names).toEqual([FAKE_B])
  })

  test("skips disabled binding", async () => {
    await db
      .update(llmVendorsAndModels)
      .set({ enabled: false })
      .where(eq(llmVendorsAndModels.vendorId, ids.fakeA))
    const names = (await listMediaRoutes(MODEL)).map((r) => r.vendorName)
    expect(names).toEqual([FAKE_B])
  })

  test("skips llm kind and unregistered slugs", async () => {
    const names = (await listMediaRoutes(MODEL)).map((r) => r.vendorName)
    expect(names).not.toContain(LLM_VENDOR)
    expect(names).not.toContain(UNREGISTERED)
  })

  test("skips registered vendor without an API key", async () => {
    const envName = `${FAKE_A.toUpperCase().replace(/-/g, "_")}_API_KEY`
    const previous = process.env[envName]
    delete process.env[envName]
    try {
      const names = (await listMediaRoutes(MODEL)).map((r) => r.vendorName)
      expect(names).toEqual([FAKE_B])
    } finally {
      process.env[envName] = previous
    }
  })
})
