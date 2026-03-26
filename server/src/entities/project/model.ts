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

// Synopsis is now stored as TipTap prose format (JSONContent)
const SynopsisDTO = t.Any()
export const StoryBibleProseDTO = t.Any()

const SceneOutlineDTO = t.Object({
  scene_number: t.Number(),
  slugline: t.String(),
  characters_present: t.Array(t.String()),
  scene_goal: t.String(),
  action_summary: t.String(),
})

const BeatDTO = t.Object({
  beat_name: t.String(),
  summary: t.String(),
  scenes: t.Array(SceneOutlineDTO),
})

const OutlineDTO = t.Object({
  beats: t.Array(BeatDTO),
})

const KeyLocationDTO = t.Object({
  name: t.String(),
  description: t.String(),
  significance: t.String(),
})

const KeyCharacterDTO = t.Object({
  name: t.String(),
  role: t.Union([t.Literal("protagonist"), t.Literal("antagonist"), t.Literal("supporting")]),
  age: t.Number(),
  goal: t.String(),
})

const StoryBibleDTO = t.Object({
  world: t.Object({
    setting: t.String(),
    timePeriod: t.String(),
    worldRules: t.String(),
    socialContext: t.String(),
  }),
  conflictEngine: t.Object({
    centralConflict: t.String(),
    stakes: t.String(),
    antagonisticForce: t.String(),
    timePressure: t.String(),
    mainDramaticQuestion: t.String(),
  }),
  keyLocations: t.Array(KeyLocationDTO),
  keyCharacters: t.Array(KeyCharacterDTO),
  toneAndStyle: t.Object({
    visualStyle: t.String(),
    dialogueStyle: t.String(),
    pacing: t.String(),
  }),
  continuityRules: t.Object({
    factsToConsistent: t.String(),
    characterBehaviorRules: t.String(),
    thingsToAvoid: t.String(),
  }),
})

// DTO to create a project (minimal - just title and optional brief)
export const CreateProjectDTO = t.Object({
  title: t.String({ minLength: 1 }),
  brief: t.Optional(ProjectBriefDTO),
})

// DTO to update a project (all fields optional).
export const UpdateProjectDTO = t.Partial(t.Object({
  title: t.String({ minLength: 1 }),
  narrative_arcs: t.Union([t.Array(NarrativeArcItemDTO), t.Null()]),
  synopsis: t.Union([SynopsisDTO, t.Null()]),
  outline: t.Union([OutlineDTO, t.Null()]),
  story_bible: t.Union([StoryBibleDTO, t.Null()]),
  story_bible_prose: t.Union([StoryBibleProseDTO, t.Null()]),
  script: t.Union([t.Any(), t.Null()]), // ProseDocument is complex, use Any for flexibility
  status: t.Optional(t.UnionEnum(projectConstants.projectStatuses, {default: undefined})),
}))

// Full project response DTO
export const ProjectResponseDTO = t.Object({
  id: t.String(),
  title: t.String(),
  brief: t.Union([ProjectBriefDTO, t.Null()]),
  narrative_arcs: t.Union([t.Array(NarrativeArcItemDTO), t.Null()]),
  synopsis: t.Union([SynopsisDTO, t.Null()]),
  outline: t.Union([OutlineDTO, t.Null()]),
  story_bible: t.Union([StoryBibleDTO, t.Null()]),
  // script: t.Union([t.Any(), t.Null()]),
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

const CharacterDTO = t.Object({
  name: t.String(),
  role: t.Union([
    t.Literal("protagonist"),
    t.Literal("antagonist"),
    t.Literal("supporting"),
    t.Literal("minor"),
  ]),
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
  name: t.String(),
  description: t.String(),
})

const PropDTO = t.Object({
  name: t.String(),
  description: t.String(),
})

const CostumeDTO = t.Object({
  name: t.String(),
  description: t.String(),
  isDefault: t.Boolean(),
})

export const EntityObjectDTO = t.Union([CharacterDTO, LocationDTO, PropDTO, CostumeDTO])

// Type exports
export type CreateProject = typeof CreateProjectDTO.static
export type UpdateProject = typeof UpdateProjectDTO.static
export type ProjectResponse = typeof ProjectResponseDTO.static
export type CreateProjectResponse = typeof CreateProjectResponseDTO.static
export type ListProjectsResponse = typeof ListProjectsResponseDTO.static
