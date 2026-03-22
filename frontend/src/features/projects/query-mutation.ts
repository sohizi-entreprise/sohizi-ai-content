import { infiniteQueryOptions, queryOptions, mutationOptions } from '@tanstack/react-query'
import * as requests from './request'
import { CreateProjectInput, Entity, NarrativeArc, UpdateProjectInput } from './type'
import type { ScriptComponentType } from './request'

const keysFactory = {
    projects: () => ['projects'],
    project: (id: string) => ['project', id],
    entities: (projectId: string, limit?: number, entityType?: Entity['type']) =>
        ['project', projectId, 'entities', { limit, entityType }],
    entity: (projectId: string, entityId?: string) => ['project', projectId, 'entities', entityId],
    projectOptions: () => ['projectOptions'],
}

export const listProjectsQueryOptions = queryOptions({
    queryKey: keysFactory.projects(),
    queryFn: () => requests.listProjects(),
})

export const getProjectQueryOptions = (id: string) => queryOptions({
    queryKey: keysFactory.project(id),
    queryFn: () => requests.getProject(id),
})

export const createProjectMutationOptions = mutationOptions({
    mutationFn: (data: CreateProjectInput) => requests.createProject(data),
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