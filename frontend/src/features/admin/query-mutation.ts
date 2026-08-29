import { mutationOptions, queryOptions } from '@tanstack/react-query'
import * as requests from './requests'
import type {
  CreateCategoryInput,
  CreateCommandInput,
  CreateContentCategoryInput,
  CreateModelInput,
  CreateModelVendorBindingInput,
  CreateParameterInput,
  CreateParameterOptionInput,
  CreateSkillInput,
  CreateVendorInput,
  ReplaceModelParameterBinding,
  UpdateCommandInput,
  UpdateContentCategoryInput,
  UpdateModelInput,
  UpdateModelVendorBindingInput,
  UpdateParameterInput,
  UpdateParameterOptionInput,
  UpdateSkillInput,
  UpdateVendorInput,
  UpsertVendorOptionMapInput,
  UpsertVendorParameterMapInput,
} from './types'

const keysFactory = {
  models: ['admin', 'models'] as const,
  model: (id: string) => ['admin', 'models', id] as const,
  categories: ['admin', 'categories'] as const,
  parameters: ['admin', 'parameters'] as const,
  parameter: (id: string) => ['admin', 'parameters', id] as const,
  modelParameters: (modelId: string) =>
    ['admin', 'models', modelId, 'parameters'] as const,
  vendors: ['admin', 'vendors'] as const,
  mediaVendorSlugs: ['admin', 'media-vendor-slugs'] as const,
  commands: ['admin', 'commands'] as const,
  contentCategories: ['admin', 'content-categories'] as const,
  skills: ['admin', 'skills'] as const,
  catalogModels: (categories: string | Array<string>) =>
    [
      'catalog',
      'models',
      Array.isArray(categories) ? categories : [categories],
    ] as const,
}

export const listAdminModelsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.models,
    queryFn: requests.listAdminModels,
  })

export const getAdminModelQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keysFactory.model(id),
    queryFn: () => requests.getAdminModel(id),
  })

export const listAdminCategoriesQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.categories,
    queryFn: requests.listAdminCategories,
  })

export const createAdminCategoryMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateCategoryInput) =>
      requests.createAdminCategory(input),
    meta: {
      invalidateQueries: [keysFactory.categories, keysFactory.models],
    },
  })

export const deleteAdminCategoryMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminCategory(id),
    meta: {
      invalidateQueries: [keysFactory.categories, keysFactory.models],
    },
  })

export const listAdminParametersQueryOptions = (enabled = true) =>
  queryOptions({
    queryKey: keysFactory.parameters,
    queryFn: requests.listAdminParameters,
    enabled,
  })

export const getAdminParameterQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keysFactory.parameter(id),
    queryFn: () => requests.getAdminParameter(id),
  })

export const createAdminParameterMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateParameterInput) =>
      requests.createAdminParameter(input),
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

export const createAdminParameterOptionMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      input,
    }: {
      parameterId: string
      input: CreateParameterOptionInput
    }) => requests.createAdminParameterOption(parameterId, input),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const updateAdminParameterOptionMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      optionId,
      input,
    }: {
      parameterId: string
      optionId: string
      input: UpdateParameterOptionInput
    }) => requests.updateAdminParameterOption(parameterId, optionId, input),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const deleteAdminParameterOptionMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      optionId,
    }: {
      parameterId: string
      optionId: string
    }) => requests.deleteAdminParameterOption(parameterId, optionId),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const upsertVendorOptionMappingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      optionId,
      vendorId,
      input,
    }: {
      parameterId: string
      optionId: string
      vendorId: string
      input: UpsertVendorOptionMapInput
    }) =>
      requests.upsertVendorOptionMapping(
        parameterId,
        optionId,
        vendorId,
        input,
      ),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const deleteVendorOptionMappingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      optionId,
      vendorId,
    }: {
      parameterId: string
      optionId: string
      vendorId: string
    }) => requests.deleteVendorOptionMapping(parameterId, optionId, vendorId),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const upsertVendorParameterMappingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      vendorId,
      input,
    }: {
      parameterId: string
      vendorId: string
      input: UpsertVendorParameterMapInput
    }) => requests.upsertVendorParameterMapping(parameterId, vendorId, input),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const deleteVendorParameterMappingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      parameterId,
      vendorId,
    }: {
      parameterId: string
      vendorId: string
    }) => requests.deleteVendorParameterMapping(parameterId, vendorId),
    meta: {
      invalidateQueries: [keysFactory.parameters],
    },
  })

export const listAdminVendorsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.vendors,
    queryFn: requests.listAdminVendors,
  })

export const listMediaVendorSlugsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.mediaVendorSlugs,
    queryFn: requests.listMediaVendorSlugs,
  })

export const createAdminVendorMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateVendorInput) => requests.createAdminVendor(input),
    meta: {
      invalidateQueries: [keysFactory.vendors],
    },
  })

export const updateAdminVendorMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, input }: { id: string; input: UpdateVendorInput }) =>
      requests.updateAdminVendor(id, input),
    meta: {
      invalidateQueries: [keysFactory.vendors],
    },
  })

export const deleteAdminVendorMutationOptions = () =>
  mutationOptions({
    mutationFn: (id: string) => requests.deleteAdminVendor(id),
    meta: {
      invalidateQueries: [keysFactory.vendors],
    },
  })

export const createModelVendorBindingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      modelId,
      input,
    }: {
      modelId: string
      input: CreateModelVendorBindingInput
    }) => requests.createModelVendorBinding(modelId, input),
    meta: {
      invalidateQueries: [keysFactory.models, keysFactory.vendors],
    },
  })

export const updateModelVendorBindingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      modelId,
      vendorId,
      input,
    }: {
      modelId: string
      vendorId: string
      input: UpdateModelVendorBindingInput
    }) => requests.updateModelVendorBinding(modelId, vendorId, input),
    meta: {
      invalidateQueries: [keysFactory.models, keysFactory.vendors],
    },
  })

export const deleteModelVendorBindingMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      modelId,
      vendorId,
    }: {
      modelId: string
      vendorId: string
    }) => requests.deleteModelVendorBinding(modelId, vendorId),
    meta: {
      invalidateQueries: [keysFactory.models, keysFactory.vendors],
    },
  })

export const listModelParametersQueryOptions = (
  modelId: string | null,
  enabled = true,
) =>
  queryOptions({
    queryKey: keysFactory.modelParameters(modelId ?? ''),
    queryFn: () => requests.listModelParameters(modelId!),
    enabled: enabled && Boolean(modelId),
  })

export const replaceModelParametersMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      modelId,
      input,
    }: {
      modelId: string
      input: Array<ReplaceModelParameterBinding>
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

export const listCatalogModelsQueryOptions = (
  categories: string | Array<string>,
) =>
  queryOptions({
    queryKey: keysFactory.catalogModels(categories),
    queryFn: () => requests.listCatalogModels(categories),
    enabled:
      (Array.isArray(categories) ? categories.join(',') : categories).length >
      0,
  })

export const listAdminCommandsQueryOptions = () =>
  queryOptions({
    queryKey: keysFactory.commands,
    queryFn: requests.listAdminCommands,
  })

export const createAdminCommandMutationOptions = () =>
  mutationOptions({
    mutationFn: (input: CreateCommandInput) =>
      requests.createAdminCommand(input),
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
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: UpdateContentCategoryInput
    }) => requests.updateAdminContentCategory(id, input),
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
