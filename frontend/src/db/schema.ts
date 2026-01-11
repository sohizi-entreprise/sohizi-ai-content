import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core'

// Enums
export const projectStatusEnum = pgEnum('project_status', [
  'DRAFT',
  'OUTLINE_GENERATED',
  'OUTLINE_CONFIRMED',
  'SHOTS_GENERATED',
])

export const projectFormatEnum = pgEnum('project_format', [
  'storytime',
  'explainer',
  'documentary',
  'presenter',
])

export const audienceEnum = pgEnum('audience', [
  'general',
  'kids',
  'teens',
  'adult',
])

export const timeOfDayEnum = pgEnum('time_of_day', [
  'dawn',
  'day',
  'sunset',
  'night',
  'unspecified',
])

export const characterRoleEnum = pgEnum('character_role', [
  'protagonist',
  'antagonist',
  'supporting',
  'narrator',
  'unknown',
])

export const shotTypeEnum = pgEnum('shot_type', [
  'establishing',
  'wide',
  'medium',
  'closeup',
  'insert',
])

export const shotAngleEnum = pgEnum('shot_angle', [
  'eye_level',
  'low',
  'high',
  'over_shoulder',
  'top_down',
])

export const shotMovementEnum = pgEnum('shot_movement', [
  'static',
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
])

// Tables
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  format: projectFormatEnum('format').notNull(),
  status: projectStatusEnum('status').default('DRAFT').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const projectBriefs = pgTable('project_briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  logline: text('logline').notNull(),
  audience: audienceEnum('audience').default('general').notNull(),
  tone: text('tone'),
  genre: text('genre'),
  stylePackId: text('style_pack_id'),
  constraints: jsonb('constraints').$type<{
    must_include: string[]
    must_avoid: string[]
    forbidden_phrases: string[]
  }>(),
  rawLlmJson: jsonb('raw_llm_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const outlineActs = pgTable('outline_acts', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  actId: text('act_id').notNull(),
  order: integer('order').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  goals: jsonb('goals').$type<string[]>(),
  turningPoints: jsonb('turning_points').$type<string[]>(),
  sceneIds: jsonb('scene_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const scenes = pgTable('scenes', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  sceneId: text('scene_id').notNull(),
  actId: text('act_id'),
  order: integer('order').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  mood: text('mood'),
  timeOfDay: timeOfDayEnum('time_of_day').default('unspecified'),
  locationRef: text('location_ref'),
  rawLlmJson: jsonb('raw_llm_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const characters = pgTable('characters', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  characterId: text('character_id').notNull(),
  name: text('name').notNull(),
  role: characterRoleEnum('role').default('unknown'),
  description: text('description').notNull(),
  lockedTraits: jsonb('locked_traits').$type<string[]>(),
  defaultCostumeId: text('default_costume_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const locations = pgTable('locations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  locationId: text('location_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  timeOfDayDefault: timeOfDayEnum('time_of_day_default').default('unspecified'),
  lighting: text('lighting'),
  palette: jsonb('palette').$type<string[]>(),
  mustInclude: jsonb('must_include').$type<string[]>(),
  mustAvoid: jsonb('must_avoid').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const props = pgTable('props', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  propId: text('prop_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  isRecurring: boolean('is_recurring').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const costumes = pgTable('costumes', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  costumeId: text('costume_id').notNull(),
  characterRef: text('character_ref'),
  name: text('name').notNull(),
  description: text('description').notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const shots = pgTable('shots', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  sceneDbId: uuid('scene_db_id')
    .references(() => scenes.id, { onDelete: 'cascade' })
    .notNull(),
  shotId: text('shot_id').notNull(),
  order: integer('order').notNull(),
  shotType: shotTypeEnum('shot_type').default('medium'),
  angle: shotAngleEnum('angle').default('eye_level'),
  lens: text('lens'),
  movement: shotMovementEnum('movement').default('static'),
  visualSummary: text('visual_summary').notNull(),
  composition: text('composition'),
  action: text('action'),
  moodKeywords: jsonb('mood_keywords').$type<string[]>(),
  entitiesInShot: jsonb('entities_in_shot').$type<{
    character_ids: string[]
    location_id: string
    prop_ids: string[]
    costume_ids: string[]
  }>(),
  spoken: jsonb('spoken').$type<
    Array<{
      utterance_id: string
      kind: 'narration' | 'dialogue'
      speaker_id: string
      text: string
    }>
  >(),
  constraints: jsonb('constraints').$type<{
    must_keep: string[]
    must_avoid: string[]
    allow_variation: string[]
  }>(),
  rawLlmJson: jsonb('raw_llm_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const shotImages = pgTable('shot_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  shotDbId: uuid('shot_db_id')
    .references(() => shots.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').default('fal').notNull(),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  negativePrompt: text('negative_prompt'),
  seed: integer('seed'),
  imageUrl: text('image_url').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Type exports for use in app
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

export type ProjectBrief = typeof projectBriefs.$inferSelect
export type NewProjectBrief = typeof projectBriefs.$inferInsert

export type OutlineAct = typeof outlineActs.$inferSelect
export type NewOutlineAct = typeof outlineActs.$inferInsert

export type Scene = typeof scenes.$inferSelect
export type NewScene = typeof scenes.$inferInsert

export type Character = typeof characters.$inferSelect
export type NewCharacter = typeof characters.$inferInsert

export type Location = typeof locations.$inferSelect
export type NewLocation = typeof locations.$inferInsert

export type Prop = typeof props.$inferSelect
export type NewProp = typeof props.$inferInsert

export type Costume = typeof costumes.$inferSelect
export type NewCostume = typeof costumes.$inferInsert

export type Shot = typeof shots.$inferSelect
export type NewShot = typeof shots.$inferInsert

export type ShotImage = typeof shotImages.$inferSelect
export type NewShotImage = typeof shotImages.$inferInsert
