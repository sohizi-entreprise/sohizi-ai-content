import { db } from "@/db"
import { commands, type Command } from "@/db/schema"
import { asc, eq } from "drizzle-orm"

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
