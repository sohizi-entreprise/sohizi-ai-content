import { projectConstants } from '@/constants'
import { t } from 'elysia'

/*
- DTO to create a project
- DTO to update a project
*/ 


export const CreateProjectDTO = t.Object({
  name: t.String(),
  format: t.UnionEnum(projectConstants.projectFormats),
  language: t.String(),
  audience: t.String(),
  tone: t.String(),
  genre: t.String(),
  initialInput: t.Union([
    t.Object({
      type: t.Literal("prompt"),
      content: t.String(),
    }),
    t.Object({
      type: t.Literal("file"),
      content: t.String(),
    }),
  ]),
})

export const UpdateProjectDTO = t.Object({
  name: t.String(),
})

export const ProjectResponseDTO = t.Object({
  id: t.String(),
  name: t.String(),
  format: t.UnionEnum(projectConstants.projectFormats),
  audience: t.String(),
  tone: t.String(),
  genre: t.String(),
  language: t.String(),
  initialInput: t.Union([
    t.Object({
      type: t.Literal("prompt"),
      content: t.String(),
    }),
    t.Object({
      type: t.Literal("file"),
      content: t.String(),
    }),
    t.Null(),
  ]),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

export const ListProjectsResponseDTO = t.Object({
  id: t.String(),
  name: t.String(),
  format: t.String(),
  genre: t.String(),
  createdAt: t.Date(),
  shotCount: t.Number(),
})

export const CreateProjectResponseDTO = t.Object({
  project: ProjectResponseDTO,
  requestId: t.String(),
})

export type CreateProject = typeof CreateProjectDTO.static
export type UpdateProject = typeof UpdateProjectDTO.static
export type ProjectResponse = typeof ProjectResponseDTO.static
export type CreateProjectResponse = typeof CreateProjectResponseDTO.static
export type ListProjectsResponse = typeof ListProjectsResponseDTO.static