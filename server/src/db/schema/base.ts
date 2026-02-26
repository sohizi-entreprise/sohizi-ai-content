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
import { ProjectBrief, ProseDocument, StoryBible, Synopsis, NarrativeArcList, OutlineList } from 'zSchemas';
  
const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
}

export const blockStatusEnum = pgEnum('block_status', ['PENDING', 'DRAFT', 'ERROR', 'APPROVED']);
export const entityTypeEnum = pgEnum('entity_type', ['CHARACTER', 'LOCATION', 'PROP', 'COSTUME']);
export const imageOwnerTypeEnum = pgEnum('image_owner_type', ['PROJECT', 'SHOT', 'ENTITY']);

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
    title: varchar('title', {length: 100}).notNull(),
    brief: jsonb('brief').notNull().$type<ProjectBrief>(),
    narrative_arcs: jsonb('narrative_arcs').$type<NarrativeArcList>(),
    synopsis: jsonb('synopsis').$type<Synopsis>(),
    outline: jsonb('outline').$type<OutlineList>(),
    story_bible: jsonb('story_bible').$type<StoryBible>(),
    script: jsonb('script').$type<ProseDocument>(),
    status: varchar('status', {length: 50}).default('DRAFT').notNull().$type<projectConstants.ProjectStatus>(),
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
  
  // Chat enums
  export const chatEditorTypeEnum = pgEnum('chat_editor_type', ['synopsis', 'script', 'bible', 'outline']);
  export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant', 'system']);

  // Chat tables
  export const conversations = pgTable('conversations', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).default('New Chat').notNull(),
    editorType: chatEditorTypeEnum('editor_type').notNull(),
    ...timestamps,
  })

  export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    role: chatMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    context: jsonb('context').$type<{
      id: string
      type: 'selection' | 'character' | 'location' | 'scene'
      label: string
      content: string
      metadata?: Record<string, unknown>
    }[]>(),
    mentions: jsonb('mentions').$type<{
      id: string
      type: 'character' | 'location'
      name: string
      description?: string
    }[]>(),
    ...timestamps,
  })

  // Type exports for use in app
  export type Project = typeof projects.$inferSelect
  export type Image = typeof images.$inferSelect
  export type Entity = typeof entities.$inferSelect
  export type Scene = typeof scenes.$inferSelect
  export type Segment = typeof segments.$inferSelect
  export type Shot = typeof shots.$inferSelect
  export type GenerationRequest = typeof generationRequests.$inferSelect
  export type Conversation = typeof conversations.$inferSelect
  export type Message = typeof messages.$inferSelect

  export type GenerationRequestStatus = (typeof generationRequestStatusEnum.enumValues)[number]
  export type GenerationRequestType = (typeof generationRequestTypeEnum.enumValues)[number]
  export type ChatEditorType = (typeof chatEditorTypeEnum.enumValues)[number]
  export type ChatMessageRole = (typeof chatMessageRoleEnum.enumValues)[number]
  
  