import { db } from '@/db'
import { categories } from '@/db/schema'
import type { CategoryType } from '@/type'
import { asc, eq, inArray } from 'drizzle-orm'

export type ContentCategory = typeof categories.$inferSelect

export const listAllContentCategories = async (): Promise<
  ContentCategory[]
> => {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.displayPriority), asc(categories.name))
}

export const getContentCategoryById = async (
  id: string,
): Promise<ContentCategory | null> => {
  const rows = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)
  return rows[0] ?? null
}

export const createContentCategory = async (input: {
  name: string
  slug: string
  type: CategoryType
  description?: string | null
  displayPriority?: number
}): Promise<ContentCategory> => {
  const [created] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: input.slug,
      type: input.type,
      description: input.description ?? null,
      displayPriority: input.displayPriority ?? 0,
    })
    .returning()
  return created
}

export const updateContentCategory = async (
  id: string,
  fields: Partial<{
    name: string
    slug: string
    type: CategoryType
    description: string | null
    displayPriority: number
  }>,
): Promise<ContentCategory | null> => {
  const [updated] = await db
    .update(categories)
    .set(fields)
    .where(eq(categories.id, id))
    .returning()
  return updated ?? null
}

export const deleteContentCategory = async (id: string): Promise<boolean> => {
  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id })
  return deleted.length > 0
}

export const contentCategoriesExist = async (
  ids: string[],
): Promise<boolean> => {
  if (ids.length === 0) return true
  const uniqueIds = [...new Set(ids)]
  const rows = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inArray(categories.id, uniqueIds))
  return rows.length === uniqueIds.length
}
