import { db } from "@/db"
import { memories } from "@/db/schema/base"
import { MemoryLoadingPolicy, MemoryScope } from "@/type"
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm"

type CreateMemoryParams = {
  userId: string
  projectId: string
  content: string
  scope: MemoryScope
  loadingPolicy: MemoryLoadingPolicy
  maxRecords: number
}

type MemoryAccess = {
  userId: string
  projectId: string
}

type UpdateLastUsedAtParams = MemoryAccess & {
  ids: string[]
}

function visibleTo({ userId, projectId }: MemoryAccess): SQL {
  return or(
    and(eq(memories.scope, "project"), eq(memories.projectId, projectId)),
    and(eq(memories.scope, "user"), eq(memories.userId, userId)),
    and(
      eq(memories.scope, "user-project"),
      eq(memories.projectId, projectId),
      eq(memories.userId, userId),
    ),
  )!
}

export const listMemories = async (payload: MemoryAccess) => {
  const response = await db
    .select({
      id: memories.id,
      content: memories.content,
      createdAt: memories.createdAt,
      loadingPolicy: memories.loadingPolicy,
      scope: memories.scope,
    })
    .from(memories)
    .where(visibleTo(payload))
    .orderBy(desc(memories.lastUsedAt))
  return response
}

function scopeFilter(payload: CreateMemoryParams): SQL {
  switch (payload.scope) {
    case "project":
      return and(
        eq(memories.scope, "project"),
        eq(memories.projectId, payload.projectId),
      )!
    case "user":
      return and(
        eq(memories.scope, "user"),
        eq(memories.userId, payload.userId),
      )!
    case "user-project":
      return and(
        eq(memories.scope, "user-project"),
        eq(memories.projectId, payload.projectId),
        eq(memories.userId, payload.userId),
      )!
  }
}

export const updateLastUsedAt = async ({
  ids,
  userId,
  projectId,
}: UpdateLastUsedAtParams) => {
  if (ids.length === 0) return
  await db
    .update(memories)
    .set({ lastUsedAt: new Date() })
    .where(and(inArray(memories.id, ids), visibleTo({ userId, projectId })))
}

export const appendMemory = async (payload: CreateMemoryParams) => {
  const where = scopeFilter(payload)

  return db.transaction(async (tx) => {
    const keepExisting = Math.max(payload.maxRecords - 1, 0)
    await tx.execute(sql`
      DELETE FROM ${memories}
      WHERE ${memories.id} IN (
        SELECT ${memories.id}
        FROM ${memories}
        WHERE ${where}
        ORDER BY ${memories.lastUsedAt} DESC
        OFFSET ${keepExisting}
      )
    `)

    if (payload.maxRecords < 1) return null

    const [memory] = await tx
      .insert(memories)
      .values({
        userId: payload.userId,
        projectId: payload.projectId,
        content: payload.content,
        scope: payload.scope,
        loadingPolicy: payload.loadingPolicy,
      })
      .returning()
    return memory
  })
}

type UpdateMemoryParams = MemoryAccess & {
  id: string
  content?: string
  scope?: MemoryScope
  loadingPolicy?: MemoryLoadingPolicy
}

export const updateMemory = async ({
  id,
  userId,
  projectId,
  content,
  scope,
  loadingPolicy,
}: UpdateMemoryParams) => {
  const fields: Partial<
    Pick<UpdateMemoryParams, "content" | "scope" | "loadingPolicy">
  > = {}
  if (content !== undefined) fields.content = content
  if (scope !== undefined) fields.scope = scope
  if (loadingPolicy !== undefined) fields.loadingPolicy = loadingPolicy
  if (Object.keys(fields).length === 0) return null

  const [memory] = await db
    .update(memories)
    .set({ ...fields, userId, projectId, lastUsedAt: new Date() })
    .where(and(eq(memories.id, id), visibleTo({ userId, projectId })))
    .returning()
  return memory ?? null
}
