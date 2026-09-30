import type {
  CreateTemplateInput,
  CreateTemplateResponse,
  FileNode,
  PaginatedResponse,
  ProjectAssetFile,
  ProjectListItem,
  ProjectOptions,
  ProjectResponse,
} from "./type"
import type { createProjectSchema } from "./schema"
import type { z } from "zod"
import api from "@/lib/axios"
import { throwApiError } from "@/lib/errors"

export const listProjects = async (
  cursor?: string,
  limit?: number,
): Promise<PaginatedResponse<ProjectListItem>> => {
  const response = await api.get("/projects", { params: { cursor, limit } })
  return response.data
}

export const getProject = async (
  id: string,
): Promise<{
  project: Omit<ProjectResponse, "format" | "genre">
  rootFolderId: string
  rootFiles: Array<FileNode>
}> => {
  try {
    const response = await api.get(`/projects/${id}`)
    return response.data
  } catch (error) {
    throwApiError(error, "Failed to get project", {
      notFound: "Project not found",
    })
  }
}

export const deleteProject = async (id: string) => {
  const response = await api.delete(`/projects/${id}`)
  return response.data
}

export const createProject = async (
  data: z.infer<typeof createProjectSchema>,
): Promise<ProjectResponse> => {
  const response = await api.post("/projects", data)
  return response.data
}

export const getProjectOptions = async (): Promise<ProjectOptions> => {
  const response = await api.get("/projects/options")
  return response.data
}

export const listFileTreePerDirectory = async (
  projectId: string,
  parentId: string,
): Promise<Array<FileNode>> => {
  const response = await api.get(`/projects/${projectId}/files`, {
    params: { parentId },
  })
  return response.data
}

type SearchFilesByNameOptions = {
  signal?: AbortSignal
  directory?: boolean
  type?: string
  format?: string
}

export type Command = {
  id: string
  name: string
  action: string
  isPublic: boolean
  projectId: string | null
  createdAt: string
  updatedAt: string
}

type SearchCommandsOptions = {
  signal?: AbortSignal
}

export const searchCommands = async (
  projectId: string,
  name: string,
  limit?: number,
  options?: SearchCommandsOptions,
): Promise<Array<Command>> => {
  const response = await api.get(`/projects/${projectId}/commands/search`, {
    params: {
      name,
      limit,
    },
    signal: options?.signal,
  })
  return response.data
}

export const getFileNodeByPath = async (
  projectId: string,
  path: string,
): Promise<FileNode> => {
  const response = await api.get(`/projects/${projectId}/files/by-path`, {
    params: { path },
  })
  return response.data
}

export const getFileNodeById = async (
  projectId: string,
  fileId: string,
): Promise<FileNode> => {
  const response = await api.get(`/projects/${projectId}/files/${fileId}/node`)
  return response.data
}

export const searchFilesByName = async (
  projectId: string,
  name: string,
  limit?: number,
  options?: SearchFilesByNameOptions,
): Promise<Array<FileNode>> => {
  const response = await api.get(`/projects/${projectId}/files/search`, {
    params: {
      name,
      limit,
      directory: options?.directory,
      type: options?.type,
      format: options?.format,
    },
    signal: options?.signal,
  })
  return response.data
}

export const listFilesByType = async (
  projectId: string,
  type: string,
  limit = 100,
  options?: { signal?: AbortSignal },
): Promise<Array<FileNode>> => {
  const response = await api.get(`/projects/${projectId}/files/by-type`, {
    params: { type, limit },
    signal: options?.signal,
  })
  return response.data
}

export type ListProjectAssetsOptions = {
  name?: string
  type?: "image" | "video" | "audio"
  limit?: number
  signal?: AbortSignal
}

export const listProjectAssets = async (
  projectId: string,
  options?: ListProjectAssetsOptions,
): Promise<Array<ProjectAssetFile>> => {
  const response = await api.get(`/projects/${projectId}/files/assets`, {
    params: {
      name: options?.name,
      type: options?.type,
      limit: options?.limit,
    },
    signal: options?.signal,
  })
  return response.data
}

export type FolderMediaFile = {
  id: string
  name: string
  url: string
  type: "image" | "video" | "audio"
}

export const listFolderMedia = async (
  projectId: string,
  folderId: string,
  options?: {
    type?: "image" | "video" | "audio"
    limit?: number
    signal?: AbortSignal
  },
): Promise<Array<FolderMediaFile>> => {
  const response = await api.get(
    `/projects/${projectId}/files/${folderId}/media`,
    {
      params: {
        type: options?.type,
        limit: options?.limit,
      },
      signal: options?.signal,
    },
  )
  return response.data
}

export const createFileNode = async (
  projectId: string,
  data: {
    name: string
    directory: boolean
    parentId: string
    position: number
    type: string | null
    format: string | null
  },
): Promise<FileNode> => {
  const response = await api.post(`/projects/${projectId}/files`, {
    ...data,
    projectId,
  })
  return response.data
}

export const renameFileNode = async (
  projectId: string,
  fileId: string,
  name: string,
): Promise<FileNode> => {
  const response = await api.put(
    `/projects/${projectId}/files/${fileId}/rename`,
    { name },
  )
  return response.data
}

export const moveFileNode = async (
  projectId: string,
  fileId: string,
  data: {
    parentId?: string | null
    anchorId?: string | null
    position: "start" | "end" | "before" | "after"
  },
): Promise<FileNode> => {
  const response = await api.put(
    `/projects/${projectId}/files/${fileId}/move`,
    data,
  )
  return response.data
}

export const deleteFileNode = async (
  projectId: string,
  fileId: string,
): Promise<{ ok: boolean }> => {
  const response = await api.delete(`/projects/${projectId}/files/${fileId}`)
  return response.data
}

export const createTemplate = async (
  data: CreateTemplateInput,
): Promise<CreateTemplateResponse> => {
  const response = await api.post("/projects/templates", data)
  return response.data
}
