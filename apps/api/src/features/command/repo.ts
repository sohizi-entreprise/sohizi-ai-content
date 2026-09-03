import { db } from "@/db"
import { commands, type Command } from "@/db/schema"
import { and, asc, eq, or, sql } from "drizzle-orm"

const escapeLikePattern = (value: string) => {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`)
}

export const listAllCommands = async (): Promise<Command[]> => {
  return db.select().from(commands).orderBy(asc(commands.name))
}

export const getCommandById = async (id: string): Promise<Command | null> => {
  const rows = await db
    .select()
    .from(commands)
    .where(eq(commands.id, id))
    .limit(1)
  return rows[0] ?? null
}

export const createCommand = async (input: {
  name: string
  action: string
  visible?: boolean
}): Promise<Command> => {
  const [created] = await db
    .insert(commands)
    .values({
      name: input.name,
      action: input.action,
      visible: input.visible ?? false,
      isPublic: true,
      projectId: null,
    })
    .returning()
  return created
}

export const updateCommand = async (
  id: string,
  fields: Partial<{ name: string; action: string; visible: boolean }>,
): Promise<Command | null> => {
  const [updated] = await db
    .update(commands)
    .set(fields)
    .where(eq(commands.id, id))
    .returning()
  return updated ?? null
}

export const deleteCommand = async (id: string): Promise<boolean> => {
  const deleted = await db
    .delete(commands)
    .where(eq(commands.id, id))
    .returning({ id: commands.id })
  return deleted.length > 0
}

export const searchCommands = async (
  projectId: string,
  name: string,
  limit = 15,
): Promise<Command[]> => {
  const normalizedName = name.trim()
  if (!normalizedName) {
    return []
  }

  const escapedName = escapeLikePattern(normalizedName)
  const containsPattern = `%${escapedName}%`
  const prefixPattern = `${escapedName}%`
  const exactName = normalizedName.toLowerCase()

  return db
    .select()
    .from(commands)
    .where(
      and(
        eq(commands.visible, true),
        or(eq(commands.isPublic, true), eq(commands.projectId, projectId)),
        sql`${commands.name} ILIKE ${containsPattern} ESCAPE '\\'`,
      ),
    )
    .orderBy(
      sql`CASE
        WHEN lower(${commands.name}) = ${exactName} THEN 0
        WHEN ${commands.name} ILIKE ${prefixPattern} ESCAPE '\\' THEN 1
        ELSE 2
      END`,
      commands.name,
    )
    .limit(limit)
}

export const resolveCommandsByNames = async (
  projectId: string,
  names: string[],
): Promise<Command[]> => {
  const uniqueNames = [
    ...new Set(names.map((name) => name.trim().toLowerCase()).filter(Boolean)),
  ]
  if (uniqueNames.length === 0) {
    return []
  }

  const rows = await db
    .select()
    .from(commands)
    .where(
      and(
        eq(commands.visible, true),
        or(eq(commands.isPublic, true), eq(commands.projectId, projectId)),
        sql`lower(${commands.name}) IN (${sql.join(
          uniqueNames.map((name) => sql`${name}`),
          sql`, `,
        )})`,
      ),
    )

  const byName = new Map<string, Command>()
  for (const row of rows) {
    const key = row.name.toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, row)
      continue
    }

    if (row.projectId === projectId && existing.projectId !== projectId) {
      byName.set(key, row)
    }
  }

  return uniqueNames
    .map((name) => byName.get(name))
    .filter((command): command is Command => command !== undefined)
}
