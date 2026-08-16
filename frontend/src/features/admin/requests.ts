import api from '@/lib/axios'
import type {
  AdminCategory,
  AdminCommand,
  AdminContentCategory,
  AdminModel,
  AdminModelDetail,
  AdminModelsCatalog,
  AdminParameter,
  AdminParameterDetail,
  AdminParameterOption,
  AdminSkill,
  AdminVendor,
  CatalogModel,
  CreateCategoryInput,
  CreateCommandInput,
  CreateContentCategoryInput,
  CreateModelInput,
  CreateModelVendorBindingInput,
  CreateParameterInput,
  CreateParameterOptionInput,
  CreateSkillInput,
  CreateVendorInput,
  ModelParameterBinding,
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

export const listAdminModels = async (): Promise<AdminModelsCatalog> => {
  const response = await api.get('/admin/models')
  return response.data
}

export const getAdminModel = async (id: string): Promise<AdminModelDetail> => {
  const response = await api.get(`/admin/models/${encodeURIComponent(id)}`)
  return response.data
}

export const createAdminModel = async (input: CreateModelInput): Promise<AdminModelDetail> => {
  const response = await api.post('/admin/models', input)
  return response.data
}

export const updateAdminModel = async (id: string, input: UpdateModelInput): Promise<AdminModelDetail> => {
  const response = await api.patch(`/admin/models/${encodeURIComponent(id)}`, input)
  return response.data
}

export const deleteAdminModel = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/models/${encodeURIComponent(id)}`)
  return response.data
}

export const listAdminCategories = async (): Promise<AdminCategory[]> => {
  const response = await api.get('/admin/categories')
  return response.data
}

export const createAdminCategory = async (input: CreateCategoryInput): Promise<AdminCategory> => {
  const response = await api.post('/admin/categories', input)
  return response.data
}

export const deleteAdminCategory = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/categories/${id}`)
  return response.data
}

export const listAdminParameters = async (): Promise<AdminParameter[]> => {
  const response = await api.get('/admin/parameters')
  return response.data
}

export const getAdminParameter = async (id: string): Promise<AdminParameterDetail> => {
  const response = await api.get(`/admin/parameters/${id}`)
  return response.data
}

export const createAdminParameter = async (input: CreateParameterInput): Promise<AdminParameterDetail> => {
  const response = await api.post('/admin/parameters', input)
  return response.data
}

export const updateAdminParameter = async (
  id: string,
  input: UpdateParameterInput,
): Promise<AdminParameterDetail> => {
  const response = await api.patch(`/admin/parameters/${id}`, input)
  return response.data
}

export const deleteAdminParameter = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/parameters/${id}`)
  return response.data
}

export const createAdminParameterOption = async (
  parameterId: string,
  input: CreateParameterOptionInput,
): Promise<AdminParameterOption> => {
  const response = await api.post(`/admin/parameters/${parameterId}/options`, input)
  return response.data
}

export const updateAdminParameterOption = async (
  parameterId: string,
  optionId: string,
  input: UpdateParameterOptionInput,
): Promise<AdminParameterOption> => {
  const response = await api.patch(`/admin/parameters/${parameterId}/options/${optionId}`, input)
  return response.data
}

export const deleteAdminParameterOption = async (
  parameterId: string,
  optionId: string,
): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/parameters/${parameterId}/options/${optionId}`)
  return response.data
}

export const upsertVendorOptionMapping = async (
  parameterId: string,
  optionId: string,
  vendorId: string,
  input: UpsertVendorOptionMapInput,
) => {
  const response = await api.put(
    `/admin/parameters/${parameterId}/options/${optionId}/vendors/${vendorId}`,
    input,
  )
  return response.data
}

export const deleteVendorOptionMapping = async (
  parameterId: string,
  optionId: string,
  vendorId: string,
): Promise<{ ok: true }> => {
  const response = await api.delete(
    `/admin/parameters/${parameterId}/options/${optionId}/vendors/${vendorId}`,
  )
  return response.data
}

export const upsertVendorParameterMapping = async (
  parameterId: string,
  vendorId: string,
  input: UpsertVendorParameterMapInput,
) => {
  const response = await api.put(`/admin/parameters/${parameterId}/vendors/${vendorId}`, input)
  return response.data
}

export const deleteVendorParameterMapping = async (
  parameterId: string,
  vendorId: string,
): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/parameters/${parameterId}/vendors/${vendorId}`)
  return response.data
}

export const listAdminVendors = async (): Promise<AdminVendor[]> => {
  const response = await api.get('/admin/vendors')
  return response.data
}

export const createAdminVendor = async (input: CreateVendorInput): Promise<AdminVendor> => {
  const response = await api.post('/admin/vendors', input)
  return response.data
}

export const updateAdminVendor = async (id: string, input: UpdateVendorInput): Promise<AdminVendor> => {
  const response = await api.patch(`/admin/vendors/${id}`, input)
  return response.data
}

export const deleteAdminVendor = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/vendors/${id}`)
  return response.data
}

export const createModelVendorBinding = async (
  modelId: string,
  input: CreateModelVendorBindingInput,
): Promise<AdminModelDetail> => {
  const response = await api.post(`/admin/models/${encodeURIComponent(modelId)}/vendors`, input)
  return response.data
}

export const updateModelVendorBinding = async (
  modelId: string,
  vendorId: string,
  input: UpdateModelVendorBindingInput,
): Promise<AdminModelDetail> => {
  const response = await api.patch(
    `/admin/models/${encodeURIComponent(modelId)}/vendors/${vendorId}`,
    input,
  )
  return response.data
}

export const deleteModelVendorBinding = async (
  modelId: string,
  vendorId: string,
): Promise<AdminModelDetail> => {
  const response = await api.delete(
    `/admin/models/${encodeURIComponent(modelId)}/vendors/${vendorId}`,
  )
  return response.data
}

export const listModelParameters = async (modelId: string): Promise<ModelParameterBinding[]> => {
  const response = await api.get(`/admin/models/${encodeURIComponent(modelId)}/parameters`)
  return response.data
}

export const replaceModelParameters = async (
  modelId: string,
  input: ReplaceModelParameterBinding[],
): Promise<ModelParameterBinding[]> => {
  const response = await api.put(`/admin/models/${encodeURIComponent(modelId)}/parameters`, input)
  return response.data
}

export const listCatalogModels = async (
  categories: string | string[],
): Promise<CatalogModel[]> => {
  const categoriesParam = Array.isArray(categories) ? categories.join(',') : categories
  const response = await api.get('/models', {
    params: { categories: categoriesParam },
  })
  return response.data
}

export const listAdminCommands = async (): Promise<AdminCommand[]> => {
  const response = await api.get('/admin/commands')
  return response.data
}

export const createAdminCommand = async (input: CreateCommandInput): Promise<AdminCommand> => {
  const response = await api.post('/admin/commands', input)
  return response.data
}

export const updateAdminCommand = async (
  id: string,
  input: UpdateCommandInput,
): Promise<AdminCommand> => {
  const response = await api.patch(`/admin/commands/${id}`, input)
  return response.data
}

export const deleteAdminCommand = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/commands/${id}`)
  return response.data
}

export const listAdminContentCategories = async (): Promise<AdminContentCategory[]> => {
  const response = await api.get('/admin/content-categories')
  return response.data
}

export const createAdminContentCategory = async (
  input: CreateContentCategoryInput,
): Promise<AdminContentCategory> => {
  const response = await api.post('/admin/content-categories', input)
  return response.data
}

export const updateAdminContentCategory = async (
  id: string,
  input: UpdateContentCategoryInput,
): Promise<AdminContentCategory> => {
  const response = await api.patch(`/admin/content-categories/${id}`, input)
  return response.data
}

export const deleteAdminContentCategory = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/content-categories/${id}`)
  return response.data
}

export const listAdminSkills = async (): Promise<AdminSkill[]> => {
  const response = await api.get('/admin/skills')
  return response.data
}

export const createAdminSkill = async (input: CreateSkillInput): Promise<AdminSkill> => {
  const response = await api.post('/admin/skills', input)
  return response.data
}

export const updateAdminSkill = async (id: string, input: UpdateSkillInput): Promise<AdminSkill> => {
  const response = await api.patch(`/admin/skills/${id}`, input)
  return response.data
}

export const deleteAdminSkill = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/skills/${id}`)
  return response.data
}

export const getAdminErrorMessage = (err: unknown, fallback: string) => {
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response
    ?.data
  return data?.error || data?.message || (err instanceof Error ? err.message : fallback)
}
