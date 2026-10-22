import { db } from "@/db"
import { assetVariants, assets, fileNodes, projects } from "@/db/schema"
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  sql,
  type SQL,
} from "drizzle-orm"
import { deleteFiles } from "./storage"

export const ASSET_RETENTION_MS = 24 * 60 * 60 * 1000

export function assetExpiresAt(now = new Date()) {
  return new Date(now.getTime() + ASSET_RETENTION_MS)
}

/** Sets expire_at only when it is still null, so a later delete keeps the original deadline. */
export async function expireAssets(
  where: SQL,
  now = new Date(),
): Promise<number> {
  const updated = await db
    .update(assets)
    .set({ expireAt: assetExpiresAt(now) })
    .where(and(where, isNull(assets.expireAt)))
    .returning({ id: assets.id })
  return updated.length
}

export async function expireAssetsForProject(
  projectId: string,
  now = new Date(),
) {
  return expireAssets(eq(assets.projectId, projectId), now)
}

export async function expireAssetsForOrganizations(
  organizationIds: string[],
  now = new Date(),
) {
  if (organizationIds.length === 0) return 0
  const where = inArray(
    assets.projectId,
    db
      .select({ id: projects.id })
      .from(projects)
      .where(inArray(projects.organizationId, organizationIds)),
  )
  return expireAssets(where, now)
}

export async function expireAssetsForFileNode(
  projectId: string,
  fileNodeId: string,
  now = new Date(),
) {
  const [node] = await db
    .select({ path: fileNodes.path })
    .from(fileNodes)
    .where(
      and(eq(fileNodes.projectId, projectId), eq(fileNodes.id, fileNodeId)),
    )
    .limit(1)
  if (!node) return 0

  const where = and(
    eq(assets.projectId, projectId),
    inArray(
      assets.fileNodeId,
      db
        .select({ id: fileNodes.id })
        .from(fileNodes)
        .where(
          and(
            eq(fileNodes.projectId, projectId),
            sql`${fileNodes.path} <@ ${node.path}::ltree`,
          ),
        ),
    ),
  )
  if (!where) return 0
  return expireAssets(where, now)
}

/**
 * Deletes R2 objects for expired assets, then the rows. A storage failure
 * leaves the rows so the next sweep can retry.
 */
export async function purgeExpiredAssets(
  limit: number,
  now = new Date(),
  deleteStorage: (storageKeys: string[]) => Promise<void> = deleteFiles,
): Promise<number> {
  const expired = await db
    .select({ id: assets.id, storageKey: assets.storageKey })
    .from(assets)
    .where(and(isNotNull(assets.expireAt), lt(assets.expireAt, now)))
    .orderBy(asc(assets.expireAt))
    .limit(limit)
  if (expired.length === 0) return 0

  const ids = expired.map((row) => row.id)
  const variants = await db
    .select({ storageKey: assetVariants.storageKey })
    .from(assetVariants)
    .where(inArray(assetVariants.assetId, ids))
  await deleteStorage([
    ...expired.map((row) => row.storageKey),
    ...variants.map((row) => row.storageKey),
  ])

  const deleted = await db
    .delete(assets)
    .where(
      and(
        inArray(assets.id, ids),
        isNotNull(assets.expireAt),
        lt(assets.expireAt, now),
      ),
    )
    .returning({ id: assets.id })
  return deleted.length
}
