import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    jsonb,
    varchar,
    pgEnum,
    index,
    uniqueIndex,
    customType,
  } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { projectConstants } from '@/constants'
import { ProjectBrief, StoryBible, NarrativeArcList, Outline } from 'zSchemas';
import { AgentRunFinishReason, 
         ChatMetadata, 
         MsgContent, 
         MsgMetadata, 
         ProseDocument, 
         SceneContent, 
         GenerationRequestStatus, 
         GenerationRequestType, 
         EntityType,
         ProjectPhase,
         ShotVisuals,
         ShotAudio
  } from '@/type';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});
  
const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
}

export const imageOwnerTypeEnum = pgEnum('image_owner_type', ['PROJECT', 'SHOT', 'ENTITY']);


export const generationRequests = pgTable('generation_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  status: varchar('status', {length: 50}).default('ENQUEUED').notNull().$type<GenerationRequestStatus>(),
  type: varchar('type', {length: 50}).notNull().$type<GenerationRequestType>(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  error: text('error'),
  ...timestamps,
}, (table) => ([
  index('generation_requests_status_idx').on(table.status),
]))

  // Tables
  export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', {length: 100}).notNull(),
    brief: jsonb('brief').notNull().$type<ProjectBrief>(),
    narrative_arcs: jsonb('narrative_arcs').$type<NarrativeArcList>(),
    synopsis: jsonb('synopsis').$type<ProseDocument>(),
    outline: jsonb('outline').$type<Outline>(),
    story_bible: jsonb('story_bible').$type<StoryBible>(),
    story_bible_prose: jsonb('story_bible_prose').$type<ProseDocument>(),
    script: jsonb('script').$type<ProseDocument>(),
    status: varchar('status', {length: 50}).default('DRAFT').notNull().$type<projectConstants.ProjectStatus>(),
    phase: varchar('phase', {length: 50}).default('DRAFT').notNull().$type<ProjectPhase>(),
    ...timestamps,
  })
  
  export const scenes = pgTable('scenes', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    order: integer('order').notNull(),
    content: jsonb('content').$type<SceneContent[]>().notNull(),
    fullText: tsvector('full_text').generatedAlwaysAs(
      sql`to_tsvector('simple', public.scene_content_search_text("content"))`
    ),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('scenes_project_id_id_unique').on(table.projectId, table.id),
    index('scenes_full_text_idx').using('gin', table.fullText),
  ]))

  
  export const shots = pgTable('shots', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    sceneId: uuid('scene_id')
      .references(() => scenes.id, { onDelete: 'cascade' })
      .notNull(),

    actionDescription: text('action_description').notNull(),
    visuals: jsonb('visuals').$type<ShotVisuals>(),
    audio: jsonb('audio').$type<ShotAudio>(),
    constraints: jsonb('constraints').$type<{
      negative_prompt: string[]
      must_keep: string[]
      must_avoid: string[]
    }>(),
    compiledPrompts: jsonb('compiled_prompts').$type<{
      image: string
      audio: string
    }>(),
    ...timestamps,
  })

  export const entities = pgTable('entities', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', {length: 150}).notNull(),
    slug: varchar('slug', {length: 150}).notNull(),
    type: varchar('type', {length: 50}).$type<EntityType>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull(),
    prose: jsonb('prose').$type<ProseDocument>(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('entities_project_type_slug_unique').on(table.projectId, table.type, table.slug),
  ]))

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
  export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant', 'tool']);

  // Chat tables
  export const conversations = pgTable('conversations', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).default('New Chat').notNull(),
    ...timestamps,
  }, (table) => ([
    index('conversations_project_id_idx').on(table.projectId),
  ]))

  export const agent_runs = pgTable('agent_runs', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    finishReason: varchar('finish_reason', { length: 50 }).default('not-finished').notNull().$type<AgentRunFinishReason>(),
    error: text('error'),
    metadata: jsonb('metadata').$type<ChatMetadata>(),
    ...timestamps,
  }, (table) => ([
    index('agent_runs_conversation_id_idx').on(table.conversationId),
  ]))

  export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    runId: uuid('run_id')
      .references(() => agent_runs.id, { onDelete: 'cascade' })
      .notNull(),
    role: chatMessageRoleEnum('role').notNull(),
    content: jsonb('content').$type<MsgContent[]>().notNull(),
    metadata: jsonb('metadata').$type<MsgMetadata>().default({}),
    ...timestamps,
  }, (table) => ([
    index('messages_conversation_id_idx').on(table.conversationId),
    index('messages_run_id_idx').on(table.runId),
  ]))


  export const agentRunsRelations = relations(agent_runs, ({ one, many }) => ({
    conversation: one(conversations, {
      fields: [agent_runs.conversationId],
      references: [conversations.id],
    }),
    messages: many(messages),
  }))

  export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
      fields: [messages.conversationId],
      references: [conversations.id],
    }),
    agentRun: one(agent_runs, {
      fields: [messages.runId],
      references: [agent_runs.id]
    }),
  }))

  // Type exports for use in app
  export type Project = typeof projects.$inferSelect
  export type Image = typeof images.$inferSelect
  export type Entity = typeof entities.$inferSelect
  export type Scene = typeof scenes.$inferSelect
  export type Shot = typeof shots.$inferSelect
  export type GenerationRequest = typeof generationRequests.$inferSelect
  export type Conversation = typeof conversations.$inferSelect
  export type Message = typeof messages.$inferSelect
  export type AgentRun = typeof agent_runs.$inferSelect
  export type ChatMessageRole = (typeof chatMessageRoleEnum.enumValues)[number]
  
  