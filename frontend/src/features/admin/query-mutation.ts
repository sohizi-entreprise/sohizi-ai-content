import { mutationOptions, queryOptions } from '@tanstack/react-query'
import * as requests from './requests'
import type {
  CreateCommandInput,
  CreateContentCategoryInput,
  CreateModelInput,
  CreateParameterInput,
  CreateSkillInput,
  ReplaceModelParameterBinding,
  UpdateCommandInput,
  UpdateContentCategoryInput,
  UpdateModelInput,
  UpdateParameterInput,
  UpdateSkillInput,
} from './types'

const keysFactory = {
  models: ['admin', 'models'] as const,
  categories: ['admin', 'categories'] as const,
  parameters: ['admin', 'parameters'] as const,
  modelParameters: (modelId: string) => ['admin', 'models', modelId, 'parameters'] as const,
  commands: ['admin', 'commands'] as const,
  contentCategories: ['admin', 'content-categories'] as const,
  skills: ['admin', 'skills'] as const,
  catalogModels: (categories: string | string[]) =>
    ['catalog', 'models', Array.isArray(categories) ? categories : [categories]] as const,
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

export const listAdminParametersQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.parameters,
    queryFn: requests.listAdminParameters,
  })

export const createAdminParameterMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateParameterInput) => requests.createAdminParameter(input),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const updateAdminParameterMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateParameterInput }) =>
      requests.updateAdminParameter(id, input),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const deleteAdminParameterMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminParameter(id),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const listModelParametersQueryOptions = (modelId: string | null) =>
  queryOptions({
    queryKey: keysFactory.modelParameters(modelId ?? ''),
    queryFn: () => requests.listModelParameters(modelId!),
    enabled: Boolean(modelId),
  })

export const replaceModelParametersMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      modelId,
      input,
    }: {
      modelId: string
      input: ReplaceModelParameterBinding[]
    }) => requests.replaceModelParameters(modelId, input),
    meta: {
      invalidateQueries: [keysFactory.models],
    },
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

export const deleteAdminModelMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminModel(id),
    meta: {
      invalidateQueries: [keysFactory.models],
    },
  })

export const listCatalogModelsQueryOptions = (categories: string | string[]) =>
  queryOptions({
    queryKey: keysFactory.catalogModels(categories),
    queryFn: () => requests.listCatalogModels(categories),
    enabled: (Array.isArray(categories) ? categories.join(',') : categories).length > 0,
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
