import { queryOptions, mutationOptions } from '@tanstack/react-query'
import * as requests from './request'
import { CreateProjectInput, UpdateProjectInput } from './type'

const keysFactory = {
    projects: () => ['projects'],
    project: (id: string) => ['project', id],
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