import { infiniteQueryOptions, queryOptions, mutationOptions } from '@tanstack/react-query'
import * as requests from './request'
import { Entity, NarrativeArc, ProseDocument, UpdateProjectInput } from './type'
import type { ScriptComponentType } from './request'
import { createProjectSchema } from './schema'
import { z } from 'zod'

const keysFactory = {
    projects: () => ['projects'],
    project: (id: string) => ['project', id],
    fileTree: (projectId: string, parentId: string) => ['project', projectId, 'file-tree', parentId],
    entities: (projectId: string, limit?: number, entityType?: Entity['type']) =>
        ['project', projectId, 'entities', { limit, entityType }],
    entity: (projectId: string, entityId?: string) => ['project', projectId, 'entities', entityId],
    projectOptions: () => ['projectOptions'],
    scenes: (projectId: string) => ['project', projectId, 'scenes'],
    storyBible: (projectId: string) => ['project', projectId, 'story-bible'],
}

export const listProjectsQueryOptions = queryOptions({
    queryKey: keysFactory.projects(),
    queryFn: () => requests.listProjects(),
})

export const getListProjectsQueryOptions = ({cursor, limit}: {cursor?: string, limit?: number})  => infiniteQueryOptions({
    queryKey: keysFactory.projects(),
    queryFn: ({ pageParam }) => requests.listProjects(pageParam, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: cursor,
    select: (data) => data.pages.flatMap(page => page.data)
})

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


// ===========

export const getSelectNarrativeArcMutationOptions = (id: string) => mutationOptions({
    mutationFn: (data: NarrativeArc[]) => requests.selectNarrativeArc(id, data),
    meta: {
        invalidateQueries: [keysFactory.project(id)],
    }
})

export const getGenerateContentMutationOptions = (id: string) => mutationOptions({
    mutationFn: (componentType: ScriptComponentType) => requests.generateContent(id, componentType),
})

export const getCancelGenerateStreamMutationOptions = (id: string) => mutationOptions({
    mutationFn: () => requests.cancelGenerateStream(id),
})

export const getInfiniteListEntitiesQueryOptions = (
    projectId: string,
    cursor?: string,
    limit?: number,
    entityType?: Entity['type']
) => infiniteQueryOptions({
    queryKey: keysFactory.entities(projectId, limit, entityType),
    initialPageParam: cursor,
    queryFn: ({ pageParam }) => requests.listEntities(projectId, pageParam, limit, entityType),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    select: (data) => data.pages.flatMap(page => page.items),
})

export const getEntityQueryOptions = (projectId: string, entityId?: string) => queryOptions({
    queryKey: keysFactory.entity(projectId, entityId),
    queryFn: () => {
        if (!entityId) throw new Error('Entity ID is required')
        return requests.getEntity(projectId, entityId)
    },
    enabled: !!projectId && !!entityId,
})

export const getUpdateEntityMutationOptions = (projectId: string, entityId: string) => mutationOptions({
    mutationFn: (data: Entity['metadata']) => requests.updateEntity(projectId, entityId, data),
    meta: {
        invalidateQueries: [
            keysFactory.entity(projectId, entityId),
            keysFactory.project(projectId),
        ],
    },
})

export const getDeleteEntityMutationOptions = (projectId: string, entityId: string) => mutationOptions({
    mutationFn: () => requests.deleteEntity(projectId, entityId),
    meta: {
        invalidateQueries: [
            keysFactory.project(projectId),
            keysFactory.entities(projectId),
            keysFactory.entity(projectId, entityId),
        ],
    },
})

export const getRegenerateEntityMutationOptions = (projectId: string, entityId: string) => mutationOptions({
    mutationFn: () => requests.regenerateEntity(projectId, entityId),
    meta: {
        invalidateQueries: [
            keysFactory.entity(projectId, entityId),
        ],
    },
})

export const getGetScenesQueryOptions = (projectId: string) => queryOptions({
    queryKey: keysFactory.scenes(projectId),
    queryFn: () => requests.getScenes(projectId),
})

export const getStoryBibleQueryOptions = (projectId: string) => queryOptions({
    queryKey: keysFactory.storyBible(projectId),
    queryFn: () => requests.getStoryBible(projectId),
})

export const saveStoryBibleMutationOptions = (projectId: string) => mutationOptions({
    mutationFn: (prose: ProseDocument) => requests.saveStoryBible(projectId, prose),
    meta: {
        invalidateQueries: [keysFactory.storyBible(projectId)],
    },
})