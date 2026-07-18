import { db } from '@/db'
import { categories, skillCategories, skills, type Skill } from '@/db/schema'
import type { TemplateAndSkillStatus, TemplateAndSkillVisibility } from '@/type'
import { asc, eq } from 'drizzle-orm'

export type AdminSkill = Skill & {
  categoryIds: string[]
  categories: Array<{ id: string; name: string; slug: string; type: string }>
}

const aggregateSkills = (
  rows: Array<{
    skill: Skill
    categoryId: string | null
    categoryName: string | null
    categorySlug: string | null
    categoryType: string | null
  }>,
): AdminSkill[] => {
  const byId = new Map<string, AdminSkill>()

  for (const row of rows) {
    let skill = byId.get(row.skill.id)
    if (!skill) {
      skill = {
        ...row.skill,
        categoryIds: [],
        categories: [],
      }
      byId.set(row.skill.id, skill)
    }

    if (row.categoryId && row.categoryName && row.categorySlug && row.categoryType) {
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
      skill: skills,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryType: categories.type,
    })
    .from(skills)
    .leftJoin(skillCategories, eq(skills.id, skillCategories.skillId))
    .leftJoin(categories, eq(skillCategories.categoryId, categories.id))
    .orderBy(asc(skills.name))

  return aggregateSkills(rows)
}

export const getSkillById = async (id: string): Promise<AdminSkill | null> => {
  const rows = await db
    .select({
      skill: skills,
      categoryId: categories.id,
      categoryName: categories.name,
      categorySlug: categories.slug,
      categoryType: categories.type,
    })
    .from(skills)
    .leftJoin(skillCategories, eq(skills.id, skillCategories.skillId))
    .leftJoin(categories, eq(skillCategories.categoryId, categories.id))
    .where(eq(skills.id, id))

  if (rows.length === 0) return null
  return aggregateSkills(rows)[0] ?? null
}

export const createSkill = async (input: {
  name: string
  description: string
  instructions: string
  status?: TemplateAndSkillStatus
  visibility?: TemplateAndSkillVisibility
}): Promise<Skill> => {
  const [created] = await db
    .insert(skills)
    .values({
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      status: input.status ?? 'draft',
      visibility: input.visibility ?? 'private',
      fileNodeId: null,
    })
    .returning()
  return created
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
): Promise<Skill | null> => {
  const [updated] = await db.update(skills).set(fields).where(eq(skills.id, id)).returning()
  return updated ?? null
}

export const deleteSkill = async (id: string): Promise<boolean> => {
  const deleted = await db.delete(skills).where(eq(skills.id, id)).returning({ id: skills.id })
  return deleted.length > 0
}

export const replaceSkillCategories = async (skillId: string, categoryIds: string[]) => {
  await db.delete(skillCategories).where(eq(skillCategories.skillId, skillId))
  if (categoryIds.length === 0) return
  await db.insert(skillCategories).values(
    categoryIds.map((categoryId) => ({
      skillId,
      categoryId,
    })),
  )
}
