import { BadRequest, InternalServerError, NotFound } from '@/features/error'
import {
  FileSystemConflictError,
  FileSystemInputError,
  createFileNode as createFileNodeFn,
} from '@/features/file-system/functions'
import * as fileSystemRepo from '@/features/file-system/repo'
import { normalizeFileName } from '@/features/file-system/utils'
import { NameConflictError } from './errors'
import * as repo from './repo'
import type { InstallSkillInput } from './schema'

function resolveSkillFileName(name: string) {
  const normalized = normalizeFileName(name)
  if (!normalized) {
    throw new BadRequest('Invalid skill name')
  }
  if (normalized.length > 50) {
    throw new BadRequest('Skill name must be 50 characters or less')
  }
  return normalized
}

export const listMarketSkills = async (query: { q?: string; categoryId?: string }) => {
  return repo.listPublicCatalogSkills(query)
}

export const getMarketSkill = async (id: string) => {
  const skill = await repo.getPublicCatalogSkillById(id)
  if (!skill) {
    throw new NotFound('Skill not found')
  }
  return skill
}

export const listMarketCategories = async () => {
  return repo.listPublicSkillCategories()
}

export const isSkillNameAvailable = async (projectId: string, name: string) => {
  const normalized = normalizeFileName(name)
  if (!normalized) {
    return { available: false }
  }
  const existing = await repo.findProjectSkillByName(projectId, normalized)
  return { available: !existing }
}

export const installSkill = async (projectId: string, input: InstallSkillInput) => {
  const catalogSkill = await repo.getPublicCatalogSkillById(input.skillId)
  if (!catalogSkill) {
    throw new NotFound('Skill not found')
  }

  const skillsFolder = await repo.findProjectSkillsFolder(projectId)
  if (!skillsFolder) {
    throw new InternalServerError('Project skills folder not found')
  }

  const mode = input.mode ?? 'create'
  const catalogFileName = resolveSkillFileName(catalogSkill.name)
  const targetName =
    mode === 'rename' ? resolveSkillFileName(input.name!) : catalogFileName

  const existing = await repo.findProjectSkillByName(projectId, targetName)

  if (mode === 'create') {
    if (existing) {
      throw new NameConflictError(existing.id)
    }
    return createSkillFile(projectId, skillsFolder.id, targetName, catalogSkill)
  }

  if (mode === 'replace') {
    const existingByCatalogName = await repo.findProjectSkillByName(
      projectId,
      catalogFileName,
    )
    if (!existingByCatalogName) {
      return createSkillFile(projectId, skillsFolder.id, catalogFileName, catalogSkill)
    }

    const updated = await fileSystemRepo.updateSkill(existingByCatalogName.id, {
      description: catalogSkill.description,
      instructions: catalogSkill.instructions,
    })
    if (!updated) {
      throw new InternalServerError('Failed to replace skill')
    }

    return {
      fileNodeId: existingByCatalogName.id,
      name: existingByCatalogName.name,
      mode: 'replace' as const,
    }
  }

  // rename
  if (existing) {
    throw new NameConflictError(existing.id)
  }

  return createSkillFile(projectId, skillsFolder.id, targetName, catalogSkill)
}

async function createSkillFile(
  projectId: string,
  parentId: string,
  name: string,
  catalogSkill: { description: string; instructions: string },
) {
  try {
    const fileNode = await createFileNodeFn(
      {
        projectId,
        name,
        directory: false,
        parentId,
        position: 0,
        format: 'skill',
        editable: true,
      },
      {
        content: '',
        jsonContent: {},
        proseContent: { type: 'doc', content: [] },
      },
      {
        skill: {
          description: catalogSkill.description,
          instructions: catalogSkill.instructions,
        },
      },
    )

    return {
      fileNodeId: fileNode.id,
      name: fileNode.name,
      mode: 'create' as const,
    }
  } catch (error) {
    if (error instanceof FileSystemConflictError || error instanceof FileSystemInputError) {
      throw new BadRequest(error.message)
    }
    console.error(error)
    throw new InternalServerError('Failed to install skill')
  }
}
