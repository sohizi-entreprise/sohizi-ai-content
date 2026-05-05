import {
    pgTable,
    uuid,
    text,
    timestamp,
    integer,
    jsonb,
    varchar,
    pgEnum,
    boolean,
    index,
    uniqueIndex,
    customType,
    foreignKey,
  } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { 
  AgentState,
  ModelCategory,
         ModelRecommendedUsage,
         MsgContent,
         ProseDocument,
         TokenPricing, 
  } from '@/type';
import { FileFormat } from '@/features/file-system/constants';

type FileNodeRelationshipType = 'appears_in' | 'derived_from' | 'wears' | 'located_in' | 'uses' | 'depends_on';

export type ProjectMetadata = {
  format: string;
  genre: string;
}

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

const avector = customType<{ data: number[] }>({
  dataType() {
    return 'vector';
  },
});
  
const timestamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
}


export const generationRequests = pgTable('generation_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .notNull(),
  status: varchar('status', {length: 50}).default('ENQUEUED').notNull().$type<string>(),
  type: varchar('type', {length: 50}).notNull().$type<string>(),
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
    metadata: jsonb('metadata').$type<ProjectMetadata>().notNull(),
    ...timestamps,
  })

export const fileNodes = pgTable('file_nodes', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', {length: 50}).notNull(),
    directory: boolean('directory').default(false).notNull(),
    parentId: uuid('parent_id'),
    position: integer('position').default(0).notNull(),
    editable: boolean('editable').default(true).notNull(),
    format: varchar('format', {length: 50}).$type<FileFormat>(),
    ...timestamps,
  }, (table) => [
    foreignKey({
      columns: [table.projectId, table.parentId],
      foreignColumns: [table.projectId, table.id],
    }).onDelete('cascade'),
    uniqueIndex('file_nodes_project_id_id_unique').on(table.projectId, table.id),
    uniqueIndex('file_nodes_project_id_parent_id_name_unique').on(table.projectId, table.parentId, table.name),
    uniqueIndex('file_nodes_project_id_root_name_unique')
      .on(table.projectId, table.name)
      .where(sql`${table.parentId} is null`),
    index('file_nodes_project_id_parent_id_position_idx').on(table.projectId, table.parentId, table.position),
  ])

export const fileNodeContents = pgTable('file_node_contents', {
    fileNodeId: uuid('file_node_id').primaryKey(),
    projectId: uuid('project_id').notNull(),
    content: text('content'),
    jsonContent: jsonb('json_content').$type<Record<string, unknown>>(),
    proseContent: jsonb('prose_content').$type<ProseDocument>(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    revision: integer('revision').default(1).notNull(),
    ...timestamps,
  }, (table) => [
    foreignKey({
      columns: [table.projectId, table.fileNodeId],
      foreignColumns: [fileNodes.projectId, fileNodes.id],
    }).onDelete('cascade'),
    uniqueIndex('file_node_contents_project_id_file_node_id_unique').on(table.projectId, table.fileNodeId),
    index('file_node_contents_project_id_idx').on(table.projectId),
  ])

export const fileNodeContentChunks = pgTable('file_node_content_chunks', {
    id: uuid('id').defaultRandom().primaryKey(),
    fileNodeId: uuid('file_node_id').notNull(),
    projectId: uuid('project_id').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    chunkText: text('chunk_text').notNull(),
    searchText: tsvector('search_text').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce("chunk_text", ''))`
    ),
    embedding: avector('embedding'),
    embeddingMetadata: jsonb('embedding_metadata').$type<Record<string, unknown>>(),
    tokenCount: integer('token_count'),
    ...timestamps,
  }, (table) => [
    foreignKey({
      columns: [table.projectId, table.fileNodeId],
      foreignColumns: [fileNodeContents.projectId, fileNodeContents.fileNodeId],
    }).onDelete('cascade'),
    uniqueIndex('file_node_content_chunks_file_node_id_chunk_index_unique').on(table.fileNodeId, table.chunkIndex),
    index('file_node_content_chunks_project_id_file_node_id_idx').on(table.projectId, table.fileNodeId),
    index('file_node_content_chunks_search_text_idx').using('gin', table.searchText),
  ])

export const fileNodeRelationships = pgTable('file_node_relationships', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull(),
    fileNodeId: uuid('file_node_id')
      .references(() => fileNodes.id, { onDelete: 'cascade' })
      .notNull(),
    relatedFileNodeId: uuid('related_file_node_id')
      .references(() => fileNodes.id, { onDelete: 'cascade' })
      .notNull(),
    relationType: varchar('relation_type', {length: 50}).$type<FileNodeRelationshipType>().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
  }, (table) => [
    uniqueIndex('file_node_relationships_project_id_file_node_id_related_file_node_id_unique').on(table.projectId, table.fileNodeId, table.relatedFileNodeId),
  ])

  // ======================== CONVERSATION =========================
  
  // Chat enums
  export const chatMessageRoleEnum = pgEnum('chat_message_role', ['user', 'assistant', 'tool']);

  // Chat tables
  export const conversations = pgTable('conversations', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).default('New Chat').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
  }, (table) => ([
    index('conversations_project_id_idx').on(table.projectId),
  ]))

  export const checkpoints = pgTable('checkpoints', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    state: jsonb('state').$type<AgentState>(),
    ...timestamps,
  }, (table) => ([
    index('checkpoints_conversation_id_idx').on(table.conversationId),
    uniqueIndex('checkpoints_project_id_conversation_id_unique').on(table.projectId, table.conversationId),
  ]))

  export const messages = pgTable('messages', {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    role: chatMessageRoleEnum('role').notNull(),
    content: jsonb('content').$type<MsgContent>().notNull(),
    ...timestamps,
  }, (table) => ([
    index('messages_conversation_id_idx').on(table.conversationId),
  ]))

  export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
      fields: [messages.conversationId],
      references: [conversations.id],
    }),
  }))

  // ========================= MODELS ==========================

  // Model tables
  export const llmModels = pgTable('llm_models', {
    id: varchar('id', { length: 50 }).primaryKey(),
    provider: varchar('provider', { length: 50 }).notNull(),
    name: varchar('name', { length: 50 }).notNull(),
    apiName: varchar('api_name', { length: 50 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    pricing: jsonb('pricing').$type<TokenPricing>(),
    category: varchar('category', { length: 50 }).array().notNull().$type<ModelCategory[]>(),
    recommendedUsage: varchar('recommended_usage', { length: 50 }).array().$type<ModelRecommendedUsage[]>(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('llm_models_provider_api_name_unique').on(table.provider, table.apiName),
  ]))

  // Type exports for use in app
  export type Project = typeof projects.$inferSelect
  export type FileNode = typeof fileNodes.$inferSelect
  export type FileNodeContent = typeof fileNodeContents.$inferSelect
  export type FileNodeContentChunk = typeof fileNodeContentChunks.$inferSelect
  export type GenerationRequest = typeof generationRequests.$inferSelect
  export type Conversation = typeof conversations.$inferSelect
  export type Message = typeof messages.$inferSelect
  export type ChatMessageRole = (typeof chatMessageRoleEnum.enumValues)[number]
  export type LlmModel = typeof llmModels.$inferSelect
  export type Checkpoint = typeof checkpoints.$inferSelect
  
  