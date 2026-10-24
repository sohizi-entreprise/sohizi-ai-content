import { db } from "@/db"
import {
  categories,
  fileNodeContents,
  fileNodes,
  skillCategories,
} from "@/db/schema"
import type { TemplateAndSkillStatus, TemplateAndSkillVisibility } from "@/type"
import { and, asc, eq } from "drizzle-orm"
import {
  parseSkillDocument,
  resolveSkillFileMetadata,
  serializeSkillDocument,
} from "@/features/file-system/skill-document"

export type AdminSkill = {
  id: string
  fileNodeId: string
  projectId: string
  name: string
  description: string
  instructions: string
  status: TemplateAndSkillStatus
  visibility: TemplateAndSkillVisibility
  categoryIds: string[]
  categories: Array<{ id: string; name: string; slug: string; type: string }>
}

const aggregateSkills = (
  rows: Array<{
    id: string
    projectId: string
    name: string
    content: string | null
    metadata: Record<string, unknown> | null
    categoryId: string | null
    categoryName: string | null
    categorySlug: string | null
    categoryType: string | null
  }>,
): AdminSkill[] => {
  const byId = new Map<string, AdminSkill>()

  for (const row of rows) {
    let skill = byId.get(row.id)
    if (!skill) {
      const document = row.content ? parseSkillDocument(row.content) : null
      if (!document) continue
      const metadata = resolveSkillFileMetadata(row.metadata)
      skill = {
        id: row.id,
        fileNodeId: row.id,
        projectId: row.projectId,
        name: row.name,
        ...document,
        ...metadata,
        categoryIds: [],
        categories: [],
      }
      byId.set(row.id, skill)
    }

    if (
      row.categoryId &&
      row.categoryName &&
      row.categorySlug &&
      row.categoryType
    ) {
      if (!skill.categoryIds.includes(row.categoryId)) {
        skill.categoryIds.push(row.categoryId)
        skill.categories.push({
          id: row.categoryId,
          name: row.categoryName,
          slug: row.categorySlug,
          type: row.categoryType,
        })
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const listAllSkills = async (): Promise<AdminSkill[]> => {
  const rows = await db
    .select({
      id: fileNodes.id,
      projectId: fileNodes.projectId,
      name: fileNodes.name,
      content: fileNodeContents.content,
      metadata: fileNodes.metadata,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryType: categories.type,
    })
    .from(fileNodes)
    .innerJoin(
      fileNodeContents,
      and(
        eq(fileNodes.id, fileNodeContents.fileNodeId),
        eq(fileNodes.projectId, fileNodeContents.projectId),
      ),
    )
    .leftJoin(skillCategories, eq(fileNodes.id, skillCategories.fileNodeId))
    .leftJoin(categories, eq(skillCategories.categoryId, categories.id))
    .where(and(eq(fileNodes.type, "skill"), eq(fileNodes.directory, false)))
    .orderBy(asc(fileNodes.name))

  return aggregateSkills(rows)
}

export const getSkillById = async (id: string): Promise<AdminSkill | null> => {
  const rows = await db
    .select({
      id: fileNodes.id,
      projectId: fileNodes.projectId,
      name: fileNodes.name,
      content: fileNodeContents.content,
      metadata: fileNodes.metadata,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryType: categories.type,
    })
    .from(fileNodes)
    .innerJoin(
      fileNodeContents,
      and(
        eq(fileNodes.id, fileNodeContents.fileNodeId),
        eq(fileNodes.projectId, fileNodeContents.projectId),
      ),
    )
    .leftJoin(skillCategories, eq(fileNodes.id, skillCategories.fileNodeId))
    .leftJoin(categories, eq(skillCategories.categoryId, categories.id))
    .where(and(eq(fileNodes.id, id), eq(fileNodes.type, "skill")))

  if (rows.length === 0) return null
  return aggregateSkills(rows)[0] ?? null
}

export const updateSkill = async (
  id: string,
  fields: Partial<{
    name: string
    description: string
    instructions: string
    status: TemplateAndSkillStatus
    visibility: TemplateAndSkillVisibility
  }>,
): Promise<AdminSkill | null> => {
  const existing = await getSkillById(id)
  if (!existing) return null
  const content =
    fields.description !== undefined || fields.instructions !== undefined
      ? serializeSkillDocument({
          description: fields.description ?? existing.description,
          instructions: fields.instructions ?? existing.instructions,
        })
      : undefined

  if (content !== undefined) {
    await db
      .update(fileNodeContents)
      .set({ content })
      .where(eq(fileNodeContents.fileNodeId, id))
  }
  if (fields.status !== undefined || fields.visibility !== undefined) {
    const node = await db
      .select({ metadata: fileNodes.metadata })
      .from(fileNodes)
      .where(eq(fileNodes.id, id))
      .limit(1)
    await db
      .update(fileNodes)
      .set({
        metadata: {
          ...(node[0]?.metadata ?? {}),
          ...(fields.status ? { status: fields.status } : {}),
          ...(fields.visibility ? { visibility: fields.visibility } : {}),
        },
      })
      .where(eq(fileNodes.id, id))
  }
  return getSkillById(id)
}

export const deleteSkill = async (id: string): Promise<boolean> => {
  const deleted = await db
    .delete(fileNodes)
    .where(eq(fileNodes.id, id))
    .returning({ id: fileNodes.id })
  return deleted.length > 0
}

export const replaceSkillCategories = async (
  skillId: string,
  categoryIds: string[],
) => {
  await db
    .delete(skillCategories)
    .where(eq(skillCategories.fileNodeId, skillId))
  if (categoryIds.length === 0) return
  await db.insert(skillCategories).values(
    categoryIds.map((categoryId) => ({
      fileNodeId: skillId,
      categoryId,
    })),
  )
}
