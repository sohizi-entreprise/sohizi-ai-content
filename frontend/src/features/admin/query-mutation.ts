import { mutationOptions, queryOptions } from '@tanstack/react-query'
import * as requests from './requests'
import type {
  CreateCommandInput,
  CreateContentCategoryInput,
  CreateModelInput,
  CreateOptionInput,
  CreateSkillInput,
  UpdateCommandInput,
  UpdateContentCategoryInput,
  UpdateModelInput,
  UpdateOptionInput,
  UpdateSkillInput,
} from './types'

const keysFactory = {
  models: ['admin', 'models'] as const,
  categories: ['admin', 'categories'] as const,
  options: ['admin', 'options'] as const,
  commands: ['admin', 'commands'] as const,
  contentCategories: ['admin', 'content-categories'] as const,
  skills: ['admin', 'skills'] as const,
  catalogModels: (categories: string | string[]) =>
    ['catalog', 'models', Array.isArray(categories) ? categories : [categories]] as const,
  catalogOptions: (modelId: string) => ['catalog', 'options', modelId] as const,
}

export const listAdminModelsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.models,
    queryFn: requests.listAdminModels,
  })

export const listAdminCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.categories,
    queryFn: requests.listAdminCategories,
  })

export const listAdminOptionsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.options,
    queryFn: requests.listAdminOptions,
  })

export const createAdminModelMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateModelInput) => requests.createAdminModel(input),
    meta: {
      invalidateQueries: [keysFactory.models],
    },
  })

export const updateAdminModelMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateModelInput }) =>
      requests.updateAdminModel(id, input),
    meta: {
      invalidateQueries: [keysFactory.models],
    },
  })

export const disableAdminModelMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.disableAdminModel(id),
    meta: {
      invalidateQueries: [keysFactory.models],
    },
  })

export const createAdminOptionMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateOptionInput) => requests.createAdminOption(input),
    meta: {
      invalidateQueries: [keysFactory.options],
    },
  })

export const updateAdminOptionMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateOptionInput }) =>
      requests.updateAdminOption(id, input),
    meta: {
      invalidateQueries: [keysFactory.options],
    },
  })

export const deactivateAdminOptionMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deactivateAdminOption(id),
    meta: {
      invalidateQueries: [keysFactory.options],
    },
  })

export const listCatalogModelsQueryOptions = (categories: string | string[]) =>
  queryOptions({
    queryKey: keysFactory.catalogModels(categories),
    queryFn: () => requests.listCatalogModels(categories),
    enabled: (Array.isArray(categories) ? categories.join(',') : categories).length > 0,
  })

export const listCatalogModelOptionsQueryOptions = (modelId: string | null) =>
  queryOptions({
    queryKey: keysFactory.catalogOptions(modelId ?? ''),
    queryFn: () => requests.listCatalogModelOptions(modelId!),
    enabled: Boolean(modelId),
  })

export const listAdminCommandsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.commands,
    queryFn: requests.listAdminCommands,
  })

export const createAdminCommandMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateCommandInput) => requests.createAdminCommand(input),
    meta: {
      invalidateQueries: [keysFactory.commands],
    },
  })

export const updateAdminCommandMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateCommandInput }) =>
      requests.updateAdminCommand(id, input),
    meta: {
      invalidateQueries: [keysFactory.commands],
    },
  })

export const deleteAdminCommandMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminCommand(id),
    meta: {
      invalidateQueries: [keysFactory.commands],
    },
  })

export const listAdminContentCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.contentCategories,
    queryFn: requests.listAdminContentCategories,
  })

export const createAdminContentCategoryMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateContentCategoryInput) =>
      requests.createAdminContentCategory(input),
    meta: {
      invalidateQueries: [keysFactory.contentCategories],
    },
  })

export const updateAdminContentCategoryMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateContentCategoryInput }) =>
      requests.updateAdminContentCategory(id, input),
    meta: {
      invalidateQueries: [keysFactory.contentCategories],
    },
  })

export const deleteAdminContentCategoryMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminContentCategory(id),
    meta: {
      invalidateQueries: [keysFactory.contentCategories],
    },
  })

export const listAdminSkillsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.skills,
    queryFn: requests.listAdminSkills,
  })

export const createAdminSkillMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateSkillInput) => requests.createAdminSkill(input),
    meta: {
      invalidateQueries: [keysFactory.skills],
    },
  })

export const updateAdminSkillMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateSkillInput }) =>
      requests.updateAdminSkill(id, input),
    meta: {
      invalidateQueries: [keysFactory.skills],
    },
  })

export const deleteAdminSkillMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminSkill(id),
    meta: {
      invalidateQueries: [keysFactory.skills],
    },
  })
