import api from '@/lib/axios'
import { isAxiosError } from 'axios'
import { ProjectResponse, UpdateProjectInput, ProjectListItem, ProjectOptions, FileNode, Template, CreateTemplateInput, CreateTemplateResponse, PaginatedResponse, PublicTemplate } from './type'
import { createProjectSchema } from './schema'
import { z } from 'zod'

export const listProjects = async (cursor?: string, limit?: number): Promise<PaginatedResponse<ProjectListItem>> => {
  const response = await api.get('/projects', { params: { cursor, limit } })
  return response.data
}

export const getProject = async (id: string): Promise<{project: Omit<ProjectResponse, 'format' | 'genre'>, rootFolderId: string, rootFiles: FileNode[]}> => {
  try {
    const response = await api.get(`/projects/${id}`)
    return response.data
    
  } catch (error) {
    switch (true) {
      case isAxiosError(error) && error.response?.status === 404:
        throw new Error('Project not found')
        // throw notFound({routeId: '/dashboard/projects/$projectId'})
      case isAxiosError(error) && error.response?.status && error.response.status >= 500:
        throw new Error('Failed to get project: Internal Server Error')
      case isAxiosError(error) && error.code === 'ERR_NETWORK':
        throw new Error('Network Error: try later!')
    
      default:
        throw new Error('Failed to get project: Unknown Error');
    }
    
  }
}

export const deleteProject = async (id: string) => {
  const response = await api.delete(`/projects/${id}`)
  return response.data
}

export const createProject = async (data: z.infer<typeof createProjectSchema>): Promise<ProjectResponse> => {
  const response = await api.post('/projects', data)
  return response.data
}

export const updateProject = async (id: string, data: UpdateProjectInput): Promise<ProjectResponse> => {
  const response = await api.put(`/projects/${id}`, data)
  return response.data
}

export const getProjectOptions = async (): Promise<ProjectOptions> => {
  const response = await api.get('/projects/options')
  return response.data
}

export const listFileTreePerDirectory = async (projectId: string, parentId: string): Promise<FileNode[]> => {
  const response = await api.get(`/projects/${projectId}/files`, { params: { parentId } })
  return response.data
}

export const createFileNode = async (projectId: string, data: {
  name: string
  directory: boolean
  parentId: string
  position: number
  format: string | null
}): Promise<FileNode> => {
  const response = await api.post(`/projects/${projectId}/files`, { ...data, projectId })
  return response.data
}

export const renameFileNode = async (projectId: string, fileId: string, name: string): Promise<FileNode> => {
  const response = await api.put(`/projects/${projectId}/files/${fileId}/rename`, { name })
  return response.data
}

export const moveFileNode = async (projectId: string, fileId: string, data: {
  parentId?: string | null
  anchorId?: string | null
  position: 'start' | 'end' | 'before' | 'after'
}): Promise<FileNode> => {
  const response = await api.put(`/projects/${projectId}/files/${fileId}/move`, data)
  return response.data
}

export const deleteFileNode = async (projectId: string, fileId: string): Promise<{ ok: boolean }> => {
  const response = await api.delete(`/projects/${projectId}/files/${fileId}`)
  return response.data
}

export const createTemplate = async (data: CreateTemplateInput): Promise<CreateTemplateResponse> => {
  const response = await api.post('/projects/templates', data)
  return response.data
}

export const listTemplates = async (
  cursor?: string,
  limit?: number,
): Promise<PaginatedResponse<Template>> => {
  const response = await api.get('/projects/templates', { params: { cursor, limit } })
  return response.data
}

export const listPublicTemplates = async (
  cursor?: string,
  limit?: number,
): Promise<PaginatedResponse<PublicTemplate>> => {
  const response = await api.get('/projects/templates/published', { params: { cursor, limit } })
  return response.data
}