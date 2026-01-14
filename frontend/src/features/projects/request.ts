import api from '@/lib/axios'
import { CreateProjectInput, ProjectResponse, UpdateProjectInput } from './type'

export const listProjects = async (): Promise<ProjectResponse[]> => {
  const response = await api.get('/projects')
  return response.data
}

export const getProject = async (id: string): Promise<ProjectResponse> => {
  const response = await api.get(`/projects/${id}`)
  return response.data
}

export const deleteProject = async (id: string) => {
  const response = await api.delete(`/projects/${id}`)
  return response.data
}

export const createProject = async (data: CreateProjectInput): Promise<ProjectResponse> => {
  const response = await api.post('/projects', data)
  return response.data
}

export const updateProject = async (id: string, data: UpdateProjectInput): Promise<ProjectResponse> => {
  const response = await api.put(`/projects/${id}`, data)
  return response.data
}