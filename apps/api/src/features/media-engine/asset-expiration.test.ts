import { afterAll, describe, expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import {
  assetVariants,
  assets,
  fileNodes,
  organization,
  projects,
} from "@/db/schema"
import { functions } from "@/lib/inngest"
import { sweepExpiredAssets } from "./asset-expiration"
import {
  assetExpiresAt,
  expireAssets,
  expireAssetsForFileNode,
  purgeExpiredAssets,
} from "./asset-retention"

const createdOrgs: string[] = []

afterAll(async () => {
  for (const id of createdOrgs) {
    await db.delete(organization).where(eq(organization.id, id))
  }
})

async function createProject() {
  const orgId = `org_${randomUUID().slice(0, 8)}`
  await db.insert(organization).values({ id: orgId, name: orgId, slug: orgId })
  createdOrgs.push(orgId)
  const [project] = await db
    .insert(projects)
    .values({ organizationId: orgId, title: "Draft" })
    .returning()
  return project
}

describe("asset expiration sweep", () => {
  test("registers an hourly sweep", () => {
    expect(functions).toContain(sweepExpiredAssets)
    expect(sweepExpiredAssets.opts).toMatchObject({
      id: "asset-expiration-sweep",
      triggers: [{ cron: "15 * * * *" }],
      concurrency: { limit: 1 },
      retries: 3,
    })
  })

  test("deletes storage keys before the asset row", async () => {
    const project = await createProject()
    const storageKey = `images/${randomUUID()}/shot.png`
    const variantKey = `images/${randomUUID()}/shot-thumb.png`
    const [asset] = await db
      .insert(assets)
      .values({
        projectId: project.id,
        name: "shot",
        type: "image",
        url: "https://example.com/shot.png",
        storageKey,
        source: "user-uploaded",
        expireAt: new Date(Date.now() - 60_000),
      })
      .returning()
    await db.insert(assetVariants).values({
      assetId: asset.id,
      type: "thumbnail",
      storageKey: variantKey,
      url: "https://example.com/shot-thumb.png",
      size: 12,
      status: "completed",
    })

    const deletedKeys: string[] = []
    try {
      const count = await purgeExpiredAssets(10, new Date(), async (keys) => {
        const [stillThere] = await db
          .select({ id: assets.id })
          .from(assets)
          .where(eq(assets.id, asset.id))
        expect(stillThere?.id).toBe(asset.id)
        if (
          keys.length !== 2 ||
          keys[0] !== storageKey ||
          keys[1] !== variantKey
        ) {
          throw new Error(`unexpected storage keys: ${keys.join(", ")}`)
        }
        deletedKeys.push(...keys)
      })

      expect(count).toBe(1)
      expect(deletedKeys).toEqual([storageKey, variantKey])
      const [remaining] = await db
        .select({ id: assets.id })
        .from(assets)
        .where(eq(assets.id, asset.id))
      expect(remaining).toBeUndefined()
    } finally {
      await db.delete(assets).where(eq(assets.id, asset.id))
    }
  })

  test("leaves the row when storage deletion fails", async () => {
    const project = await createProject()
    const storageKey = `images/${randomUUID()}/keep.png`
    const [asset] = await db
      .insert(assets)
      .values({
        projectId: project.id,
        name: "keep",
        type: "image",
        url: "https://example.com/keep.png",
        storageKey,
        source: "user-uploaded",
        expireAt: new Date(Date.now() - 60_000),
      })
      .returning()

    await expect(
      purgeExpiredAssets(10, new Date(), async () => {
        throw new Error("r2 down")
      }),
    ).rejects.toThrow("r2 down")

    const [remaining] = await db
      .select({ id: assets.id, storageKey: assets.storageKey })
      .from(assets)
      .where(eq(assets.id, asset.id))
    expect(remaining?.storageKey).toBe(storageKey)
    await db.delete(assets).where(eq(assets.id, asset.id))
  })

  test("leaves live assets alone and keeps an existing deadline", async () => {
    const project = await createProject()
    const [live] = await db
      .insert(assets)
      .values({
        projectId: project.id,
        name: "live",
        type: "image",
        url: "https://example.com/live.png",
        storageKey: `images/${randomUUID()}/live.png`,
        source: "user-uploaded",
      })
      .returning()

    const count = await purgeExpiredAssets(10, new Date(), async () => {
      throw new Error("live asset was selected")
    })
    expect(count).toBe(0)
    const [stillLive] = await db
      .select({ expireAt: assets.expireAt })
      .from(assets)
      .where(eq(assets.id, live.id))
    expect(stillLive?.expireAt).toBeNull()

    const markedAt = new Date()
    expect(await expireAssets(eq(assets.id, live.id), markedAt)).toBe(1)
    expect(await expireAssets(eq(assets.id, live.id), new Date())).toBe(0)
    const [marked] = await db
      .select({ expireAt: assets.expireAt })
      .from(assets)
      .where(eq(assets.id, live.id))
    expect(marked?.expireAt?.toISOString()).toBe(
      assetExpiresAt(markedAt).toISOString(),
    )
    await db.delete(assets).where(eq(assets.id, live.id))
  })

  test("expires assets on a deleted file and its descendants", async () => {
    const project = await createProject()
    const [folder] = await db
      .insert(fileNodes)
      .values({
        projectId: project.id,
        name: "assets",
        directory: true,
        path: "root.assets",
      })
      .returning()
    const [child] = await db
      .insert(fileNodes)
      .values({
        projectId: project.id,
        name: "shot.png",
        parentId: folder.id,
        path: "root.assets.shot_png",
      })
      .returning()
    const [other] = await db
      .insert(fileNodes)
      .values({
        projectId: project.id,
        name: "other.png",
        path: "root.other_png",
      })
      .returning()
    const [childAsset] = await db
      .insert(assets)
      .values({
        projectId: project.id,
        fileNodeId: child.id,
        name: "shot",
        type: "image",
        url: "https://example.com/shot.png",
        storageKey: `images/${randomUUID()}/shot.png`,
        source: "user-uploaded",
      })
      .returning()
    const [otherAsset] = await db
      .insert(assets)
      .values({
        projectId: project.id,
        fileNodeId: other.id,
        name: "other",
        type: "image",
        url: "https://example.com/other.png",
        storageKey: `images/${randomUUID()}/other.png`,
        source: "user-uploaded",
      })
      .returning()

    expect(await expireAssetsForFileNode(project.id, folder.id)).toBe(1)

    const rows = await db
      .select({ id: assets.id, expireAt: assets.expireAt })
      .from(assets)
      .where(eq(assets.projectId, project.id))
    const expired = rows.find((row) => row.id === childAsset.id)
    const kept = rows.find((row) => row.id === otherAsset.id)
    expect(expired?.expireAt).toBeInstanceOf(Date)
    expect(kept?.expireAt).toBeNull()

    await db.delete(assets).where(eq(assets.projectId, project.id))
    await db.delete(fileNodes).where(eq(fileNodes.projectId, project.id))
  })
})
