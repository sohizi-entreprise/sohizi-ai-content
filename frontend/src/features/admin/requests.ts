import api from '@/lib/axios'
import type {
  AdminCategory,
  AdminCommand,
  AdminContentCategory,
  AdminModel,
  AdminOption,
  AdminSkill,
  CatalogModel,
  CatalogModelOption,
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

export const disableAdminModel = async (id: string): Promise<AdminModel> => {
  const response = await api.delete(`/admin/models/${encodeURIComponent(id)}`)
  return response.data
}

export const listAdminCategories = async (): Promise<AdminCategory[]> => {
  const response = await api.get('/admin/categories')
  return response.data
}

export const listAdminOptions = async (): Promise<AdminOption[]> => {
  const response = await api.get('/admin/options')
  return response.data
}

export const createAdminOption = async (input: CreateOptionInput): Promise<AdminOption> => {
  const response = await api.post('/admin/options', input)
  return response.data
}

export const updateAdminOption = async (id: string, input: UpdateOptionInput): Promise<AdminOption> => {
  const response = await api.patch(`/admin/options/${id}`, input)
  return response.data
}

export const deactivateAdminOption = async (id: string): Promise<AdminOption> => {
  const response = await api.delete(`/admin/options/${id}`)
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

export const listCatalogModelOptions = async (modelId: string): Promise<CatalogModelOption[]> => {
  const response = await api.get(`/models/${encodeURIComponent(modelId)}/options`)
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
