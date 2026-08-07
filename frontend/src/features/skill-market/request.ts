import api from '@/lib/axios'
import { isAxiosError } from 'axios'
import type {
  InstallSkillResult,
  MarketSkill,
  MarketSkillCategory,
  NameConflictErrorBody,
} from './types'

export class SkillNameConflictError extends Error {
  readonly code = 'NAME_CONFLICT' as const
  readonly existingFileNodeId: string

  constructor(body: NameConflictErrorBody) {
    super(body.error)
    this.name = 'SkillNameConflictError'
    this.existingFileNodeId = body.existingFileNodeId
  }
}

export const listMarketSkills = async (params?: {
  q?: string
  categoryId?: string
  signal?: AbortSignal
}): Promise<MarketSkill[]> => {
  const response = await api.get('/skills/market', {
    params: {
      q: params?.q || undefined,
      categoryId: params?.categoryId || undefined,
    },
    signal: params?.signal,
  })
  return response.data
}

export const getMarketSkill = async (
  id: string,
  options?: { signal?: AbortSignal },
): Promise<MarketSkill> => {
  const response = await api.get(`/skills/market/${id}`, {
    signal: options?.signal,
  })
  return response.data
}

export const listMarketCategories = async (options?: {
  signal?: AbortSignal
}): Promise<MarketSkillCategory[]> => {
  const response = await api.get('/skills/market/categories', {
    signal: options?.signal,
  })
  return response.data
}

export const checkSkillNameAvailable = async (
  projectId: string,
  name: string,
  options?: { signal?: AbortSignal },
): Promise<{ available: boolean }> => {
  const response = await api.get(`/projects/${projectId}/skills/name-available`, {
    params: { name },
    signal: options?.signal,
  })
  return response.data
}

export const installSkill = async (
  projectId: string,
  body: {
    skillId: string
    mode?: 'create' | 'replace' | 'rename'
    name?: string
  },
): Promise<InstallSkillResult> => {
  try {
    const response = await api.post(`/projects/${projectId}/skills/install`, body)
    return response.data
  } catch (error) {
    if (
      isAxiosError(error) &&
      error.response?.status === 409 &&
      error.response.data?.code === 'NAME_CONFLICT'
    ) {
      throw new SkillNameConflictError(error.response.data as NameConflictErrorBody)
    }
    throw error
  }
}
