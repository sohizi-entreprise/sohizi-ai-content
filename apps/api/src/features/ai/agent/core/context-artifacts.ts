import { db } from "@/db"
import { artifacts } from "@/db/schema"
import type { ContextArtifact, ContextArtifactMetadata } from "@/db/schema"
import { and, asc, eq, inArray, lt } from "drizzle-orm"
import { artifactExpiresAt } from "./context-artifact-format"

export {
  ARTIFACT_TTL_MS,
  artifactAccess,
  artifactExpiresAt,
  renderStoredArtifact,
  renderToolResult,
  sameArtifactScope,
  TOOL_RESULT_PREVIEW_LENGTH,
  truncatedToolResult,
} from "./context-artifact-format"

export type ContextArtifactDraft = {
  metadata: ContextArtifactMetadata
  data: unknown
}

export async function insertContextArtifacts(
  rows: ContextArtifactDraft[],
  now = new Date(),
): Promise<string[]> {
  if (rows.length === 0) return []
  const expireAt = artifactExpiresAt(now)
  const inserted = await db
    .insert(artifacts)
    .values(rows.map((row) => ({ ...row, expireAt })))
    .returning({ id: artifacts.id })
  return inserted.map((row) => row.id)
}

export async function getContextArtifact(
  id: string,
): Promise<ContextArtifact | null> {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.id, id))
    .limit(1)
  return row ?? null
}

export async function deleteExpiredArtifacts(
  limit: number,
  now = new Date(),
): Promise<number> {
  const expired = await db
    .select({ id: artifacts.id })
    .from(artifacts)
    .where(lt(artifacts.expireAt, now))
    .orderBy(asc(artifacts.expireAt))
    .limit(limit)
  if (expired.length === 0) return 0
  const deleted = await db
    .delete(artifacts)
    .where(
      and(
        inArray(
          artifacts.id,
          expired.map((row) => row.id),
        ),
        lt(artifacts.expireAt, now),
      ),
    )
    .returning({ id: artifacts.id })
  return deleted.length
}
