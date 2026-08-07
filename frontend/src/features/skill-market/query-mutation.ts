import { mutationOptions, queryOptions } from '@tanstack/react-query'
import {
  checkSkillNameAvailable,
  getMarketSkill,
  installSkill,
  listMarketCategories,
  listMarketSkills,
} from './request'

const keysFactory = {
  marketSkills: (q?: string, categoryId?: string) =>
    ['skill-market', 'skills', q ?? '', categoryId ?? ''] as const,
  marketSkill: (id: string) => ['skill-market', 'skill', id] as const,
  marketCategories: () => ['skill-market', 'categories'] as const,
  nameAvailable: (projectId: string, name: string) =>
    ['skill-market', 'name-available', projectId, name] as const,
}

export const listMarketSkillsQueryOptions = (q?: string, categoryId?: string) =>
  queryOptions({
    queryKey: keysFactory.marketSkills(q, categoryId),
    queryFn: ({ signal }) => listMarketSkills({ q, categoryId, signal }),
    staleTime: 1000 * 60,
  })

export const getMarketSkillQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keysFactory.marketSkill(id),
    queryFn: ({ signal }) => getMarketSkill(id, { signal }),
    staleTime: 1000 * 60,
  })

export const listMarketCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.marketCategories(),
    queryFn: ({ signal }) => listMarketCategories({ signal }),
    staleTime: 1000 * 60 * 5,
  })

export const skillNameAvailableQueryOptions = (
  projectId: string,
  name: string,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: keysFactory.nameAvailable(projectId, name),
    queryFn: ({ signal }) => checkSkillNameAvailable(projectId, name, { signal }),
    enabled: enabled && name.trim().length > 0,
    staleTime: 0,
  })

export const installSkillMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (body: {
      skillId: string
      mode?: 'create' | 'replace' | 'rename'
      name?: string
    }) => installSkill(projectId, body),
  })
