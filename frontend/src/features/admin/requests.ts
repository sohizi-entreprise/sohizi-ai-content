import api from '@/lib/axios'
import type {
  AdminCategory,
  AdminCommand,
  AdminContentCategory,
  AdminModel,
  AdminParameter,
  AdminSkill,
  CatalogModel,
  CreateCommandInput,
  CreateContentCategoryInput,
  CreateModelInput,
  CreateParameterInput,
  CreateSkillInput,
  ModelParameterBinding,
  ReplaceModelParameterBinding,
  UpdateCommandInput,
  UpdateContentCategoryInput,
  UpdateModelInput,
  UpdateParameterInput,
  UpdateSkillInput,
} from './types'

export const listAdminModels = async (): Promise<AdminModel[]> => {
  const response = await api.get('/admin/models')
  return response.data
}

export const createAdminModel = async (input: CreateModelInput): Promise<AdminModel> => {
  const response = await api.post('/admin/models', input)
  return response.data
}

export const updateAdminModel = async (id: string, input: UpdateModelInput): Promise<AdminModel> => {
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

export const listAdminParameters = async (): Promise<AdminParameter[]> => {
  const response = await api.get('/admin/parameters')
  return response.data
}

export const createAdminParameter = async (input: CreateParameterInput): Promise<AdminParameter> => {
  const response = await api.post('/admin/parameters', input)
  return response.data
}

export const updateAdminParameter = async (
  id: string,
  input: UpdateParameterInput,
): Promise<AdminParameter> => {
  const response = await api.patch(`/admin/parameters/${id}`, input)
  return response.data
}

export const deleteAdminParameter = async (id: string): Promise<{ ok: true }> => {
  const response = await api.delete(`/admin/parameters/${id}`)
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
