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
import { AgentRunFinishReason, 
         ChatMetadata, 
         MsgContent, 
         MsgMetadata, 
         ProseDocument, 
         GenerationRequestStatus, 
         GenerationRequestType, 
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
    isBuiltIn: boolean('is_built_in').default(false).notNull(),
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
  export type FileNode = typeof fileNodes.$inferSelect
  export type FileNodeContent = typeof fileNodeContents.$inferSelect
  export type FileNodeContentChunk = typeof fileNodeContentChunks.$inferSelect
  export type GenerationRequest = typeof generationRequests.$inferSelect
  export type Conversation = typeof conversations.$inferSelect
  export type Message = typeof messages.$inferSelect
  export type AgentRun = typeof agent_runs.$inferSelect
  export type ChatMessageRole = (typeof chatMessageRoleEnum.enumValues)[number]
  
  