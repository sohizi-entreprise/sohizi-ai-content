import { db } from '@/db'
import { categories, fileNodes, skillCategories, skills, type Skill } from '@/db/schema'
import { and, asc, eq, ilike, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { MarketCategory, MarketSkill } from './types'

const aggregateSkills = (
  rows: Array<{
    skill: Skill
    categoryId: string | null
    categoryName: string | null
    categorySlug: string | null
    categoryType: string | null
  }>,
): MarketSkill[] => {
  const byId = new Map<string, MarketSkill>()

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

const catalogBaseWhere = and(
  eq(skills.status, 'published'),
  eq(skills.visibility, 'public'),
)

export const listPublicCatalogSkills = async (options?: {
  q?: string
  categoryId?: string
}): Promise<MarketSkill[]> => {
  const filters = [catalogBaseWhere]

  if (options?.q?.trim()) {
    filters.push(ilike(skills.name, `%${options.q.trim()}%`))
  }

  if (options?.categoryId) {
    filters.push(
      sql`exists (
        select 1 from ${skillCategories}
        where ${skillCategories.skillId} = ${skills.id}
          and ${skillCategories.categoryId} = ${options.categoryId}
      )`,
    )
  }

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
    .where(and(...filters))
    .orderBy(asc(skills.name))

  return aggregateSkills(rows)
}

export const getPublicCatalogSkillById = async (id: string): Promise<MarketSkill | null> => {
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
    .where(and(eq(skills.id, id), catalogBaseWhere))

  if (rows.length === 0) return null
  return aggregateSkills(rows)[0] ?? null
}

export const listPublicSkillCategories = async (): Promise<MarketCategory[]> => {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      type: categories.type,
    })
    .from(categories)
    .innerJoin(skillCategories, eq(categories.id, skillCategories.categoryId))
    .innerJoin(skills, eq(skillCategories.skillId, skills.id))
    .where(catalogBaseWhere)
    .orderBy(asc(categories.name))

  const byId = new Map<string, MarketCategory>()
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}

export const findProjectSkillsFolder = async (projectId: string) => {
  const coreFolder = alias(fileNodes, 'core_folder')

  const rows = await db
    .select({
      id: fileNodes.id,
      name: fileNodes.name,
      parentId: fileNodes.parentId,
      projectId: fileNodes.projectId,
    })
    .from(fileNodes)
    .innerJoin(coreFolder, eq(fileNodes.parentId, coreFolder.id))
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.directory, true),
        eq(fileNodes.name, 'skills'),
        eq(coreFolder.projectId, projectId),
        eq(coreFolder.directory, true),
        eq(coreFolder.name, 'core'),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export const findProjectSkillByName = async (projectId: string, name: string) => {
  const rows = await db
    .select({
      id: fileNodes.id,
      name: fileNodes.name,
    })
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.format, 'skill'),
        eq(fileNodes.directory, false),
        eq(fileNodes.name, name),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}
