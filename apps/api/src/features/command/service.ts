import * as repo from './repo'
import { getProjectById } from '../project/repo'
import { NotFound } from '../error'

const validateProject = async (projectId: string) => {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new NotFound('Project not found')
  }
  return project
}

export const searchCommands = async (request: {
  projectId: string
  name: string
  limit?: number
}) => {
  await validateProject(request.projectId)
  return repo.searchCommands(
    request.projectId,
    request.name,
    request.limit ?? 15,
  )
}

export const resolveCommandsByNames = async (
  projectId: string,
  names: string[],
) => {
  await validateProject(projectId)
  return repo.resolveCommandsByNames(projectId, names)
}
