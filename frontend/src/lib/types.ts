import { z } from 'zod'

// Project formats
export const PROJECT_FORMATS = [
  'storytime',
  'explainer',
  'documentary',
  'presenter',
] as const
export type ProjectFormat = (typeof PROJECT_FORMATS)[number]

// Project statuses
export const PROJECT_STATUSES = [
  'DRAFT',
  'OUTLINE_GENERATED',
  'OUTLINE_CONFIRMED',
  'SHOTS_GENERATED',
] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

// Audience types
export const AUDIENCES = ['general', 'kids', 'teens', 'adult'] as const
export type Audience = (typeof AUDIENCES)[number]

// Time of day
export const TIMES_OF_DAY = [
  'dawn',
  'day',
  'sunset',
  'night',
  'unspecified',
] as const
export type TimeOfDay = (typeof TIMES_OF_DAY)[number]

// Character roles
export const CHARACTER_ROLES = [
  'protagonist',
  'antagonist',
  'supporting',
  'narrator',
  'unknown',
] as const
export type CharacterRole = (typeof CHARACTER_ROLES)[number]

// Shot types
export const SHOT_TYPES = [
  'establishing',
  'wide',
  'medium',
  'closeup',
  'insert',
] as const
export type ShotType = (typeof SHOT_TYPES)[number]

// Shot angles
export const SHOT_ANGLES = [
  'eye_level',
  'low',
  'high',
  'over_shoulder',
  'top_down',
] as const
export type ShotAngle = (typeof SHOT_ANGLES)[number]

// Shot movements
export const SHOT_MOVEMENTS = [
  'static',
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
] as const
export type ShotMovement = (typeof SHOT_MOVEMENTS)[number]

// ===========================================
// Zod Schemas for API Validation
// ===========================================

// Create project
export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  format: z.enum(PROJECT_FORMATS),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

// Generate outline
export const generateOutlineSchema = z.object({
  sourceStory: z.string().min(1, 'Source story is required'),
  tone: z.string().nullish(),
  genre: z.string().nullish(),
  targetLengthSec: z.number().positive().nullish(),
  stylePackId: z.string().nullish(),
})
export type GenerateOutlineInput = z.infer<typeof generateOutlineSchema>

// Update outline
export const updateOutlineSchema = z.object({
  projectBrief: z
    .object({
      title: z.string().min(1),
      logline: z.string().min(1),
      audience: z.enum(AUDIENCES),
      tone: z.string().nullish(),
      genre: z.string().nullish(),
      stylePackId: z.string().nullish(),
      constraints: z
        .object({
          must_include: z.array(z.string()),
          must_avoid: z.array(z.string()),
          forbidden_phrases: z.array(z.string()),
        })
        .nullish(),
    })
    .optional(),
  acts: z
    .array(
      z.object({
        actId: z.string(),
        title: z.string(),
        summary: z.string(),
        goals: z.array(z.string()),
        turningPoints: z.array(z.string()),
        sceneIds: z.array(z.string()),
      })
    )
    .optional(),
  scenes: z
    .array(
      z.object({
        sceneId: z.string(),
        actId: z.string().nullish(),
        order: z.number(),
        title: z.string(),
        summary: z.string(),
        locationHint: z.string().nullish(),
        timeOfDay: z.enum(TIMES_OF_DAY),
        mood: z.string().nullish(),
      })
    )
    .optional(),
})
export type UpdateOutlineInput = z.infer<typeof updateOutlineSchema>

// Generate shots
export const generateShotsSchema = z.object({
  scope: z.enum(['all', 'scene']),
  sceneId: z.string().nullish(),
})
export type GenerateShotsInput = z.infer<typeof generateShotsSchema>

// Generate images
export const generateImagesSchema = z.object({
  shotIds: z.array(z.string().uuid()),
  quality: z.enum(['draft', 'final']),
  model: z.string().nullish(),
})
export type GenerateImagesInput = z.infer<typeof generateImagesSchema>

// ===========================================
// LLM JSON Output Schemas (strict validation)
// ===========================================

// Project Brief and Outline JSON (from LLM)
export const projectBriefAndOutlineJsonSchema = z.object({
  project_brief: z.object({
    title: z.string(),
    logline: z.string(),
    audience: z.enum(AUDIENCES),
    tone: z.string(),
    genre: z.string(),
    style_pack_id: z.string().nullable(),
    constraints: z.object({
      must_include: z.array(z.string()),
      must_avoid: z.array(z.string()),
      forbidden_phrases: z.array(z.string()),
    }),
  }),
  outline: z.object({
    hook_options: z.array(z.string()),
    selected_hook: z.string(),
    acts: z.array(
      z.object({
        act_id: z.string(),
        title: z.string(),
        summary: z.string(),
        goals: z.array(z.string()),
        turning_points: z.array(z.string()),
        scene_ids: z.array(z.string()),
      })
    ),
  }),
  scenes: z.array(
    z.object({
      scene_id: z.string(),
      act_id: z.string().nullable(),
      order: z.number(),
      title: z.string(),
      summary: z.string(),
      location_hint: z.string(),
      time_of_day: z.enum(TIMES_OF_DAY),
      mood: z.string(),
    })
  ),
})
export type ProjectBriefAndOutlineJson = z.infer<
  typeof projectBriefAndOutlineJsonSchema
>

// Scene Shots and Entities JSON (from LLM)
export const sceneShotsAndEntitiesJsonSchema = z.object({
  entities: z.object({
    characters: z.array(
      z.object({
        character_id: z.string(),
        name: z.string(),
        role: z.enum(CHARACTER_ROLES),
        description: z.string(),
        locked_traits: z.array(z.string()),
        default_costume_id: z.string().nullable(),
      })
    ),
    locations: z.array(
      z.object({
        location_id: z.string(),
        name: z.string(),
        description: z.string(),
        time_of_day_default: z.enum(TIMES_OF_DAY),
        lighting: z.string(),
        palette: z.array(z.string()),
        must_include: z.array(z.string()),
        must_avoid: z.array(z.string()),
      })
    ),
    props: z.array(
      z.object({
        prop_id: z.string(),
        name: z.string(),
        description: z.string(),
        is_recurring: z.boolean(),
      })
    ),
    costumes: z.array(
      z.object({
        costume_id: z.string(),
        character_id: z.string(),
        name: z.string(),
        description: z.string(),
        is_default: z.boolean(),
      })
    ),
  }),
  scenes: z.array(
    z.object({
      scene_id: z.string(),
      order: z.number(),
      title: z.string(),
      summary: z.string(),
      location_id: z.string(),
      time_of_day: z.enum(TIMES_OF_DAY),
      mood: z.string(),
      shots: z.array(
        z.object({
          shot_id: z.string(),
          scene_id: z.string(),
          order: z.number(),
          shot_type: z.enum(SHOT_TYPES),
          angle: z.enum(SHOT_ANGLES),
          lens: z.string(),
          movement: z.enum(SHOT_MOVEMENTS),
          visual_summary: z.string(),
          composition: z.string(),
          action: z.string(),
          mood_keywords: z.array(z.string()),
          entities_in_shot: z.object({
            character_ids: z.array(z.string()),
            location_id: z.string(),
            prop_ids: z.array(z.string()),
            costume_ids: z.array(z.string()),
          }),
          spoken: z.array(
            z.object({
              utterance_id: z.string(),
              kind: z.enum(['narration', 'dialogue']),
              speaker_id: z.string(),
              text: z.string(),
            })
          ),
          constraints: z.object({
            must_keep: z.array(z.string()),
            must_avoid: z.array(z.string()),
            allow_variation: z.array(z.string()),
          }),
        })
      ),
    })
  ),
})
export type SceneShotsAndEntitiesJson = z.infer<
  typeof sceneShotsAndEntitiesJsonSchema
>

// ===========================================
// UI Types (extended with relations)
// ===========================================

export interface ProjectWithDetails {
  id: string
  name: string
  format: ProjectFormat
  status: ProjectStatus
  createdAt: Date
  updatedAt: Date
  brief?: {
    id: string
    title: string
    logline: string
    audience: Audience
    tone: string | null
    genre: string | null
    constraints: {
      must_include: string[]
      must_avoid: string[]
      forbidden_phrases: string[]
    } | null
  }
  acts?: Array<{
    id: string
    actId: string
    order: number
    title: string
    summary: string
    goals: string[]
    turningPoints: string[]
    sceneIds: string[]
  }>
  scenes?: Array<{
    id: string
    sceneId: string
    actId: string | null
    order: number
    title: string
    summary: string
    mood: string | null
    timeOfDay: TimeOfDay
    locationRef: string | null
  }>
}

export interface ShotWithImage {
  id: string
  shotId: string
  sceneDbId: string
  order: number
  shotType: ShotType
  angle: ShotAngle
  lens: string | null
  movement: ShotMovement
  visualSummary: string
  composition: string | null
  action: string | null
  moodKeywords: string[]
  entitiesInShot: {
    character_ids: string[]
    location_id: string
    prop_ids: string[]
    costume_ids: string[]
  } | null
  spoken: Array<{
    utterance_id: string
    kind: 'narration' | 'dialogue'
    speaker_id: string
    text: string
  }>
  constraints: {
    must_keep: string[]
    must_avoid: string[]
    allow_variation: string[]
  } | null
  image?: {
    id: string
    imageUrl: string
    prompt: string
    seed: number | null
  }
}

export interface StoryboardScene {
  id: string
  sceneId: string
  order: number
  title: string
  summary: string
  mood: string | null
  timeOfDay: TimeOfDay
  locationRef: string | null
  shots: ShotWithImage[]
}

export interface ProjectEntities {
  characters: Array<{
    id: string
    characterId: string
    name: string
    role: CharacterRole
    description: string
    lockedTraits: string[]
    defaultCostumeId: string | null
  }>
  locations: Array<{
    id: string
    locationId: string
    name: string
    description: string
    timeOfDayDefault: TimeOfDay
    lighting: string | null
    palette: string[]
    mustInclude: string[]
    mustAvoid: string[]
  }>
  props: Array<{
    id: string
    propId: string
    name: string
    description: string
    isRecurring: boolean
  }>
  costumes: Array<{
    id: string
    costumeId: string
    characterRef: string | null
    name: string
    description: string
    isDefault: boolean
  }>
}

