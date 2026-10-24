import { db } from "@/db"
import {
  categories,
  fileNodeContents,
  fileNodes,
  skillCategories,
} from "@/db/schema"
import { and, asc, eq, ilike, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { fileType } from "@/features/file-system/constants"
import {
  parseSkillDocument,
  resolveSkillFileMetadata,
} from "@/features/file-system/skill-document"
import type { MarketCategory, MarketSkill } from "./types"

const aggregateSkills = (
  rows: Array<{
    id: string
    name: string
    content: string | null
    metadata: Record<string, unknown> | null
    categoryId: string | null
    categoryName: string | null
    categorySlug: string | null
    categoryType: string | null
  }>,
): MarketSkill[] => {
  const byId = new Map<string, MarketSkill>()

  for (const row of rows) {
    let skill = byId.get(row.id)
    if (!skill) {
      const document = row.content ? parseSkillDocument(row.content) : null
      const metadata = resolveSkillFileMetadata(row.metadata)
      if (!document) continue
      skill = {
        id: row.id,
        fileNodeId: row.id,
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

const catalogBaseWhere = and(
  eq(fileNodes.type, fileType.SKILL),
  eq(fileNodes.directory, false),
  sql`${fileNodes.metadata} ->> 'status' = 'published'`,
  sql`${fileNodes.metadata} ->> 'visibility' = 'public'`,
)

export const listPublicCatalogSkills = async (options?: {
  q?: string
  categoryId?: string
}): Promise<MarketSkill[]> => {
  const filters = [catalogBaseWhere]

  if (options?.q?.trim()) {
    filters.push(ilike(fileNodes.name, `%${options.q.trim()}%`))
  }

  if (options?.categoryId) {
    filters.push(
      sql`exists (
        select 1 from ${skillCategories}
        where ${skillCategories.fileNodeId} = ${fileNodes.id}
          and ${skillCategories.categoryId} = ${options.categoryId}
      )`,
    )
  }

  const rows = await db
    .select({
      id: fileNodes.id,
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
    .where(and(...filters))
    .orderBy(asc(fileNodes.name))

  return aggregateSkills(rows)
}

export const getPublicCatalogSkillById = async (
  id: string,
): Promise<MarketSkill | null> => {
  const rows = await db
    .select({
      id: fileNodes.id,
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
    .where(and(eq(fileNodes.id, id), catalogBaseWhere))

  if (rows.length === 0) return null
  return aggregateSkills(rows)[0] ?? null
}

export const listPublicSkillCategories = async (): Promise<
  MarketCategory[]
> => {
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      type: categories.type,
    })
    .from(categories)
    .innerJoin(skillCategories, eq(categories.id, skillCategories.categoryId))
    .innerJoin(fileNodes, eq(skillCategories.fileNodeId, fileNodes.id))
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
  const coreFolder = alias(fileNodes, "core_folder")

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
        eq(fileNodes.name, "skills"),
        eq(fileNodes.type, fileType.SKILL),
        eq(coreFolder.projectId, projectId),
        eq(coreFolder.directory, true),
        eq(coreFolder.name, "core"),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}

export const findProjectSkillByName = async (
  projectId: string,
  name: string,
) => {
  const rows = await db
    .select({
      id: fileNodes.id,
      name: fileNodes.name,
    })
    .from(fileNodes)
    .where(
      and(
        eq(fileNodes.projectId, projectId),
        eq(fileNodes.type, "skill"),
        eq(fileNodes.directory, false),
        eq(fileNodes.name, name),
      ),
    )
    .limit(1)

  return rows[0] ?? null
}
