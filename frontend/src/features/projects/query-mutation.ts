import { infiniteQueryOptions, queryOptions, mutationOptions } from '@tanstack/react-query'
import * as requests from './request'
import { CreateTemplateInput, UpdateProjectInput } from './type'
import { createProjectSchema } from './schema'
import { z } from 'zod'

const keysFactory = {
    projects: (organizationId?: string) => organizationId ? ['projects', organizationId] : ['projects'],
    project: (id: string) => ['project', id, 'info'],
    fileTree: (projectId: string, parentId: string) => ['project', projectId, 'file-tree', parentId],
    projectOptions: () => ['projectOptions'],
    templates: () => ['templates'],
    publicTemplates: () => ['templates', 'public'],
}

export const listProjectsQueryOptions = queryOptions({
    queryKey: keysFactory.projects(),
    queryFn: () => requests.listProjects(),
})

export const getListProjectsQueryOptions = ({cursor, limit, organizationId}: {cursor?: string, limit?: number, organizationId: string})  => infiniteQueryOptions({
    queryKey: keysFactory.projects(organizationId),
    queryFn: ({ pageParam }) => requests.listProjects(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: cursor,
    select: (data) => data.pages.flatMap(page => page.data),
})

export const fileTreeKey = (projectId: string, parentId: string) => keysFactory.fileTree(projectId, parentId)

export const getProjectQueryOptions = (id: string) => queryOptions({
    queryKey: keysFactory.project(id),
    queryFn: () => requests.getProject(id),
})

export const createProjectMutationOptions = mutationOptions({
    mutationFn: (data: z.infer<typeof createProjectSchema>) => requests.createProject(data),
    meta: {
        invalidateQueries: [keysFactory.projects()],
    },
})

export const updateProjectMutationOptions = (id: string) => mutationOptions({
    mutationFn: (data: UpdateProjectInput) => requests.updateProject(id, data),
    meta: {
        invalidateQueries: [keysFactory.project(id)],
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
export const getlistFileTreePerDirectoryOptions = (projectId: string, parentId: string) => queryOptions({
    queryKey: keysFactory.fileTree(projectId, parentId),
    queryFn: () => requests.listFileTreePerDirectory(projectId, parentId),
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true,
})

export const createFileNodeMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (data: {
        name: string
        directory: boolean
        parentId: string
        position: number
        format: string | null
    }) => requests.createFileNode(projectId, data),
})

export const renameFileNodeMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (data: { fileId: string; name: string }) =>
        requests.renameFileNode(projectId, data.fileId, data.name),
})

export const moveFileNodeMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (data: {
        fileId: string
        parentId?: string | null
        anchorId?: string | null
        position: 'start' | 'end' | 'before' | 'after'
    }) => requests.moveFileNode(projectId, data.fileId, {
        parentId: data.parentId,
        anchorId: data.anchorId,
        position: data.position,
    }),
})

export const deleteFileNodeMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (fileId: string) => requests.deleteFileNode(projectId, fileId),
})


// =========== TEMPLATES ===========
export const getListTemplatesQueryOptions = ({cursor, limit}: {cursor?: string, limit?: number})  => infiniteQueryOptions({
    queryKey: keysFactory.templates(),
    queryFn: ({ pageParam }) => requests.listTemplates(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: cursor,
    select: (data) => data.pages.flatMap(page => page.data)
})

export const getListPublicTemplatesQueryOptions = ({cursor, limit}: {cursor?: string, limit?: number})  => infiniteQueryOptions({
    queryKey: keysFactory.publicTemplates(),
    queryFn: ({ pageParam }) => requests.listPublicTemplates(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: cursor,
    select: (data) => data.pages.flatMap(page => page.data)
})

export const createTemplateMutationOptions = mutationOptions({
    mutationFn: (data: CreateTemplateInput) => requests.createTemplate(data),
    meta: {
        invalidateQueries: [
            keysFactory.templates(),
            keysFactory.projects(),
        ],
    },
})