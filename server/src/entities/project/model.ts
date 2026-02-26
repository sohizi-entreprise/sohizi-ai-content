import { projectConstants } from '@/constants'
import { t } from 'elysia'

// Elysia type definitions for JSONB fields
const ProjectBriefDTO = t.Object({
  format: t.String(),
  genre: t.String(),
  durationMin: t.Number(),
  tone: t.Array(t.String()),
  audience: t.String(),
  storyIdea: t.String(),
})

export const NarrativeArcItemDTO = t.Object({
  title: t.String(),
  logline: t.String(),
  synopsis: t.String(),
  genre: t.Array(t.String()),
  tone: t.Array(t.String()),
  themes: t.Array(t.String()),
  source: t.Union([t.Literal("agent"), t.Literal("user")]),
  isSelected: t.Boolean(),
})

const SynopsisDTO = t.Object({
  title: t.String(),
  text: t.String(),
})

const OutlineBeatDTO = t.Object({
  beatId: t.String(),
  title: t.String(),
  summary: t.String(),
  goals: t.Array(t.String()),
  turningPoints: t.Array(t.String()),
})

const OutlineSceneDTO = t.Object({
  sceneId: t.String(),
  slugline: t.String(),
  summary: t.String(),
})

const OutlineActDTO = t.Object({
  actId: t.String(),
  beat: OutlineBeatDTO,
  scenes: t.Array(OutlineSceneDTO),
})

const CharacterDTO = t.Object({
  id: t.String(),
  name: t.String(),
  role: t.Union([t.Literal("protagonist"), t.Literal("antagonist"), t.Literal("supporting"), t.Literal("minor")]),
  age: t.Number(),
  occupation: t.String(),
  physicalDescription: t.String(),
  personalityTraits: t.Array(t.String()),
  backstory: t.String(),
  motivation: t.String(),
  flaw: t.String(),
  voice: t.String(),
})

const LocationDTO = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
  atmosphere: t.String(),
})

const PropDTO = t.Object({
  id: t.String(),
  name: t.String(),
  description: t.String(),
})

const StoryBibleDTO = t.Object({
  timePeriod: t.String(),
  setting: t.String(),
  characters: t.Array(CharacterDTO),
  locations: t.Array(LocationDTO),
  props: t.Array(PropDTO),
})

// DTO to create a project (minimal - just title and optional brief)
export const CreateProjectDTO = t.Object({
  title: t.String({ minLength: 1 }),
  brief: t.Optional(ProjectBriefDTO),
})

// DTO to update a project (all fields optional)
export const UpdateProjectDTO = t.Partial(t.Object({
  title: t.String({ minLength: 1 }),
  narrative_arcs: t.Union([t.Array(NarrativeArcItemDTO), t.Null()]),
  synopsis: t.Union([SynopsisDTO, t.Null()]),
  outline: t.Union([t.Array(OutlineActDTO), t.Null()]),
  story_bible: t.Union([StoryBibleDTO, t.Null()]),
  script: t.Union([t.Any(), t.Null()]), // ProseDocument is complex, use Any for flexibility
  status: t.UnionEnum(projectConstants.projectStatuses),
}))

// Full project response DTO
export const ProjectResponseDTO = t.Object({
  id: t.String(),
  title: t.String(),
  brief: t.Union([ProjectBriefDTO, t.Null()]),
  narrative_arcs: t.Union([t.Array(NarrativeArcItemDTO), t.Null()]),
  synopsis: t.Union([SynopsisDTO, t.Null()]),
  outline: t.Union([t.Array(OutlineActDTO), t.Null()]),
  story_bible: t.Union([StoryBibleDTO, t.Null()]),
  script: t.Union([t.Any(), t.Null()]),
  status: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

// List projects response (lighter version)
export const ListProjectsResponseDTO = t.Object({
  id: t.String(),
  title: t.String(),
  status: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  format: t.String(),
  durationMin: t.String(),
  genre: t.String(),
})

// Create project response
export const CreateProjectResponseDTO = t.Object({
  project: ProjectResponseDTO,
  requestId: t.String(),
})

// Type exports
export type CreateProject = typeof CreateProjectDTO.static
export type UpdateProject = typeof UpdateProjectDTO.static
export type ProjectResponse = typeof ProjectResponseDTO.static
export type CreateProjectResponse = typeof CreateProjectResponseDTO.static
export type ListProjectsResponse = typeof ListProjectsResponseDTO.static
