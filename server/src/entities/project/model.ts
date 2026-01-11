import { t } from 'elysia'

/*
- DTO to create a project
- DTO to update a project
*/ 


export const CreateProjectDTO = t.Object({
  name: t.String(),
  format: t.String(),
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

export const UpdateProjectDto = t.Object({
  name: t.String(),
})

export const ProjectResponseDTO = t.Object({
  id: t.String(),
  name: t.String(),
  format: t.String(),
  language: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

export type CreateProject = typeof CreateProjectDTO.static
export type UpdateProject = typeof UpdateProjectDto.static
export type ProjectResponse = typeof ProjectResponseDTO.static