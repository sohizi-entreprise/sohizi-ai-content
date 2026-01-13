import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    jsonb,
    varchar,
    pgEnum
  } from 'drizzle-orm/pg-core'
import { projectConstants } from '@/constants'
  
const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
}

export const blockStatusEnum = pgEnum('block_status', ['PENDING', 'DRAFT', 'ERROR', 'APPROVED']);
export const entityTypeEnum = pgEnum('entity_type', ['CHARACTER', 'LOCATION', 'PROP', 'COSTUME']);
export const imageOwnerTypeEnum = pgEnum('image_owner_type', ['PROJECT', 'SHOT', 'ENTITY']);

// export const StylePresets = pgTable('style_presets', {
//   id: uuid('id').defaultRandom().primaryKey(),
//   name: text('name').notNull(),
//   description: text('description').notNull(),
//   ...timestamps,
// })

// export const CameraPresets = pgTable('camera_presets', {
//   id: uuid('id').defaultRandom().primaryKey(),
//   name: text('name').notNull(),
//   description: text('description').notNull(),
//   ...timestamps,
// })

// export const LightingPresets = pgTable('lighting_presets', {
//   id: uuid('id').defaultRandom().primaryKey(),
//   name: text('name').notNull(),
//   description: text('description').notNull(),
//   ...timestamps,
// })

export const generationRequestStatusEnum = pgEnum('generation_request_status', ['ENQUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']);
export const generationRequestTypeEnum = pgEnum('generation_request_type', ['GENERATE_BRIEF', 'GENERATE_SEGMENT', 'GENERATE_SCENE', 'GENERATE_SHOT', 'GENERATE_ENTITY', 'GENERATE_IMAGE']);

export const generationRequests = pgTable('generation_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  status: generationRequestStatusEnum('status').default('ENQUEUED').notNull(),
  type: generationRequestTypeEnum('type').notNull(),
  prompt: text('prompt'),
  error: text('error'),
  ...timestamps,
})

  // Tables
  export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    format: varchar('format', {length: 100}).notNull().$type<projectConstants.ProjectFormat>(),
    audience: varchar('audience', {length: 100}).default('general').notNull(),
    tone: text('tone').notNull(),
    genre: varchar('genre', {length: 100}).notNull(),
    language: varchar('language', {length: 10}).default('en').notNull(),
    initialInput: jsonb('initial_input').$type<{
      type: "prompt" | "file"
      content: string // In case of file, this will be the url to the file
    }>(),
    constraints: jsonb('constraints').$type<{
        mustInclude: string[]
        mustAvoid: string[]
        forbiddenPhrases: string[]
    }>(),
    ...timestamps,
  })

  export const VisualSettings = pgTable('visual_settings', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    lighting: varchar('lighting', {length: 100}),
    palette: jsonb('palette').$type<string[]>(),
    // styleRefId: uuid('style_ref_id'),
    ...timestamps,
  })
  
  export const briefs = pgTable('briefs', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title'),
    logline: text('logline'),
    content: text('content'),
    status: blockStatusEnum('status').default('PENDING').notNull(),
    ...timestamps,
  })
  
  export const segments = pgTable('segments', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    goals: jsonb('goals').$type<string[]>(),
    turningPoints: jsonb('turning_points').$type<string[]>(),
    ...timestamps,
  })
  
  export const scenes = pgTable('scenes', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    segmentId: uuid('segment_id')
      .references(() => segments.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<{
      timeOfDay: string
      location: string
    }>(),
    ...timestamps,
  })

  export const shots = pgTable('shots', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    sceneId: uuid('scene_id')
      .references(() => scenes.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').notNull(),
    visualSummary: text('visual_summary').notNull(),
    composition: text('composition').default('unspecified'),
    shotType: varchar('shot_type', {length: 100}).default('unspecified'),
    angle: varchar('angle', {length: 100}).default('unspecified'),
    lens: varchar('lens', {length: 250}).default('unspecified'),
    movement: varchar('movement', {length: 250}).default('unspecified'),
    
    constraints: jsonb('constraints').$type<{
      must_include: string[]
      must_avoid: string[]
    }>(),
    ...timestamps,
  })

  export const entities = pgTable('entities', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description').notNull(),
    type: entityTypeEnum('type').notNull(),
    ...timestamps,
  })

  export const shotToEntities = pgTable('shot_to_entities', {
    id: uuid('id').defaultRandom().primaryKey(),
    shotId: uuid('shot_id')
      .references(() => shots.id, { onDelete: 'cascade' })
      .notNull(),
    entityId: uuid('entity_id')
      .references(() => entities.id, { onDelete: 'cascade' })
      .notNull(),
    description: text('description'),
  })
  
  export const images = pgTable('images', {
    id: uuid('id').defaultRandom().primaryKey(),
    url: text('url').notNull(),
    key: text('key').notNull().unique(),
    thumbnail: text('thumbnail').notNull(),
    blurhash: text('blurhash').notNull(),
    metadata: jsonb('metadata').$type<{
      provider: string
      aspectRatio: string
      height: number
      width: number
      format: string
      size: number
      seed?: number
    }>(),
    ownerId: uuid('owner_id').notNull(),
    ownerType: imageOwnerTypeEnum('owner_type').notNull(),
    ...timestamps,
  })
  
  // Type exports for use in app
  export type Project = typeof projects.$inferSelect
  export type Image = typeof images.$inferSelect
  export type Brief = typeof briefs.$inferSelect
  export type Entity = typeof entities.$inferSelect
  export type Scene = typeof scenes.$inferSelect
  export type Segment = typeof segments.$inferSelect
  export type Shot = typeof shots.$inferSelect
  export type GenerationRequest = typeof generationRequests.$inferSelect

  export type GenerationRequestStatus = (typeof generationRequestStatusEnum.enumValues)[number]
  export type GenerationRequestType = (typeof generationRequestTypeEnum.enumValues)[number]
  
  