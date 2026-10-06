import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
} from "@tanstack/react-query"
import * as requests from "./request"
import type { z } from "zod"
import type { CreateTemplateInput } from "./type"
import type { createProjectSchema } from "./schema"

const keysFactory = {
  projects: (organizationId?: string) =>
    organizationId ? ["projects", organizationId] : ["projects"],
  project: (id: string) => ["project", id, "info"],
  fileTree: (projectId: string, parentId: string) => [
    "project",
    projectId,
    "file-tree",
    parentId,
  ],
  fileTreeChildren: (projectId: string, parentId: string) => [
    "project",
    projectId,
    "file-tree-children",
    parentId,
  ],
  filesByType: (projectId: string, type: string) => [
    "project",
    projectId,
    "files-by-type",
    type,
  ],
  projectAssets: (
    projectId: string,
    params: { name?: string; type?: string },
  ) => ["project", projectId, "assets-folder", params],
  folderMedia: (projectId: string, folderId: string, type?: string) => [
    "project",
    projectId,
    "folder-media",
    folderId,
    type,
  ],
  projectOptions: () => ["projectOptions"],
  templates: () => ["templates"],
}

export const getListProjectsQueryOptions = ({
  cursor,
  limit,
  organizationId,
}: {
  cursor?: string
  limit?: number
  organizationId: string
}) =>
  infiniteQueryOptions({
    queryKey: keysFactory.projects(organizationId),
    queryFn: ({ pageParam }) => requests.listProjects(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: cursor,
    select: (data) => data.pages.flatMap((page) => page.data),
  })

export const fileTreeKey = (projectId: string, parentId: string) =>
  keysFactory.fileTree(projectId, parentId)

export const directoryChildrenKey = (projectId: string, parentId: string) =>
  keysFactory.fileTreeChildren(projectId, parentId)

export const DIRECTORY_CHILDREN_PAGE_SIZE = 48

export const getProjectQueryOptions = (id: string) =>
  queryOptions({
    queryKey: keysFactory.project(id),
    queryFn: () => requests.getProject(id),
  })

export const createProjectMutationOptions = mutationOptions({
  mutationFn: (data: z.infer<typeof createProjectSchema>) =>
    requests.createProject(data),
  meta: {
    invalidateQueries: [keysFactory.projects()],
  },
})

export const deleteProjectMutationOptions = mutationOptions({
  mutationFn: (id: string) => requests.deleteProject(id),
  meta: {
    invalidateQueries: [keysFactory.projects()],
  },
})

export const getProjectOptionsQueryOptions = queryOptions({
  queryKey: keysFactory.projectOptions(),
  queryFn: () => requests.getProjectOptions(),
  staleTime: 1000 * 60 * 5, // 5 minutes
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
})

// =========== FILE SYSTEM ===========
export const getlistFileTreePerDirectoryOptions = (
  projectId: string,
  parentId: string,
) =>
  queryOptions({
    queryKey: keysFactory.fileTree(projectId, parentId),
    queryFn: () => requests.listFileTreePerDirectory(projectId, parentId),
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
  })

export const listDirectoryChildrenQueryOptions = (
  projectId: string,
  parentId: string,
) =>
  infiniteQueryOptions({
    queryKey: directoryChildrenKey(projectId, parentId),
    queryFn: ({ pageParam, signal }) =>
      requests.listDirectoryChildren(projectId, parentId, {
        cursor: pageParam,
        limit: DIRECTORY_CHILDREN_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  })

export const filesByTypeKey = (projectId: string, type: string) =>
  keysFactory.filesByType(projectId, type)

export const listFilesByTypeQueryOptions = (
  projectId: string,
  type: string,
  limit = 100,
) =>
  queryOptions({
    queryKey: keysFactory.filesByType(projectId, type),
    queryFn: ({ signal }) =>
      requests.listFilesByType(projectId, type, limit, { signal }),
    staleTime: 1000 * 60 * 1,
  })

/** Prefix key — use for invalidating every assets-folder query for a project. */
export const projectAssetsKey = (projectId: string) =>
  ["project", projectId, "assets-folder"] as const

export const listProjectAssetsQueryOptions = (
  projectId: string,
  options?: {
    name?: string
    type?: "image" | "video" | "audio"
    limit?: number
  },
) =>
  queryOptions({
    queryKey: keysFactory.projectAssets(projectId, {
      name: options?.name,
      type: options?.type,
    }),
    queryFn: ({ signal }) =>
      requests.listProjectAssets(projectId, {
        name: options?.name,
        type: options?.type,
        limit: options?.limit,
        signal,
      }),
    staleTime: 1000 * 60 * 1,
  })

export const listFolderMediaQueryOptions = (
  projectId: string,
  folderId: string | null,
  options?: { type?: "image" | "video" | "audio"; limit?: number },
) =>
  queryOptions({
    queryKey: keysFactory.folderMedia(projectId, folderId ?? "", options?.type),
    queryFn: ({ signal }) =>
      requests.listFolderMedia(projectId, folderId!, {
        type: options?.type,
        limit: options?.limit,
        signal,
      }),
    enabled: Boolean(folderId),
    staleTime: 1000 * 60 * 1,
  })

export const createFileNodeMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (data: {
      name: string
      directory: boolean
      parentId: string
      position: number
      type: string | null
      format: string | null
    }) => requests.createFileNode(projectId, data),
  })

export const renameFileNodeMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (data: { fileId: string; name: string }) =>
      requests.renameFileNode(projectId, data.fileId, data.name),
  })

export const moveFileNodeMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (data: {
      fileId: string
      parentId?: string | null
      anchorId?: string | null
      position: "start" | "end" | "before" | "after"
    }) =>
      requests.moveFileNode(projectId, data.fileId, {
        parentId: data.parentId,
        anchorId: data.anchorId,
        position: data.position,
      }),
  })

export const deleteFileNodeMutationOptions = (projectId: string) =>
  mutationOptions({
    mutationFn: (fileId: string) => requests.deleteFileNode(projectId, fileId),
  })

// =========== TEMPLATES ===========
export const createTemplateMutationOptions = mutationOptions({
  mutationFn: (data: CreateTemplateInput) => requests.createTemplate(data),
  meta: {
    invalidateQueries: [keysFactory.templates(), keysFactory.projects()],
  },
})
