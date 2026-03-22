import api from '@/lib/axios'
import { isAxiosError } from 'axios'
import { CreateProjectInput, ProjectResponse, UpdateProjectInput, ProjectListItem, ProjectOptions, NarrativeArc, Entity, ListEntitiesResponse } from './type'

export const listProjects = async (): Promise<ProjectListItem[]> => {
  const response = await api.get('/projects')
  return response.data
}

export const getProject = async (id: string): Promise<ProjectResponse> => {
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

export const createProject = async (data: CreateProjectInput): Promise<{ project: ProjectResponse }> => {
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

export const selectNarrativeArc = async (id: string, data: NarrativeArc[]): Promise<{ ok: boolean }> => {
  const response = await api.put(`/projects/${id}/narrative-arcs`, data)
  return response.data
}

export type ScriptComponentType = 'concept' | 'synopsis' | 'outline' | 'script' | 'world_bible_outline' | 'world_bible' | 'characters' | 'scenes'

export const generateContent = async (id: string, componentType: ScriptComponentType): Promise<{ ok: boolean; streamId: string }> => {
  const response = await api.post(`/projects/${id}/generate/${componentType}`)
  return response.data
}

export const cancelGenerateStream = async (id: string): Promise<{ ok: boolean }> => {
  const response = await api.delete(`/projects/${id}/generate/stream`)
  return response.data
}

export const listEntities = async (projectId: string, cursor?: string, limit?: number, entityType?: Entity['type']): Promise<ListEntitiesResponse> => {
  const response = await api.get(`/projects/${projectId}/entities`, { params: { cursor, limit, entityType } })
  return response.data
}

export const getEntity = async (projectId: string, entityId: string): Promise<Entity> => {
  const response = await api.get(`/projects/${projectId}/entities/${entityId}`)
  return response.data
}

export const updateEntity = async (id: string, entityId: string, data: Entity['metadata']): Promise<Entity> => {
  const response = await api.put(`/projects/${id}/entities/${entityId}`, data)
  return response.data
}

export const deleteEntity = async (projectId: string, entityId: string): Promise<{ ok: boolean }> => {
  const response = await api.delete(`/projects/${projectId}/entities/${entityId}`)
  return response.data
}

export const regenerateEntity = async (projectId: string, entityId: string): Promise<{ ok: boolean, streamId: string }> => {
  const response = await api.post(`/projects/${projectId}/entities/${entityId}/regenerate`)
  return response.data
}