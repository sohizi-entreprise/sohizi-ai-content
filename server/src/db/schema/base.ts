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
    bigint,
    serial,
    primaryKey,
  } from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import { user, organization } from './auth'
import { 
  AgentState,
  AspectRatio,
  AssetMetadata,
  AssetSource,
  AssetStatus,
  AssetType,
  AssetVariantType,
  CategoryType,
  GenerationRequestAsset,
  GenerationRequestStatus,
  GenerationRequestType,
  MsgContent,
  ProseDocument,
  TemplateAndSkillStatus,
  TemplateAndSkillVisibility,
  TokenPricing,
  VideoClipProperties,
  VideoTrackType,
  FilePendingOperation,
  FileOperationType,
  AgentRunStatus,
  AgentRunMetadata,
  AgentRunMessage,
  ModelOptionType,
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
  userId: text('user_id')
    .references(() => user.id, { onDelete: 'cascade' })
    .notNull(),
  status: varchar('status', {length: 50}).default('pending').notNull().$type<GenerationRequestStatus>(),
  type: varchar('type', {length: 50}).notNull().$type<GenerationRequestType>(),
  request: jsonb('request').$type<Record<string, unknown>>(),
  history: jsonb('history').$type<Record<string, unknown>[]>(),
  assets: jsonb('assets').$type<GenerationRequestAsset[]>(),
  error: text('error'),
  ...timestamps,
}, (table) => ([
  index('generation_requests_project_created_at_idx').on(table.projectId, table.createdAt),
  index('generation_requests_status_created_at_idx').on(table.status, table.createdAt),
  index('generation_requests_user_id_idx').on(table.userId),
]))

  // Tables
export const projects = pgTable('projects', {
    id: uuid('id').defaultRandom().primaryKey(),
    organizationId: text('organization_id')
      .references(() => organization.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', {length: 100}).notNull(),
    isTemplate: boolean('is_template').default(false).notNull(),
    fromTemplateId: uuid('from_template_id'),
    ...timestamps,
  }, (table) => ([
    index('projects_organization_id_idx').on(table.organizationId),
    foreignKey({
      columns: [table.fromTemplateId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
  ]))

export const projectBriefs = pgTable('project_briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .references(() => projects.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  content: text('content').notNull(),
  additionalSettings: jsonb('additional_settings').$type<Record<string, unknown>>(),
  ...timestamps,
}, (table) => ([
  index('project_briefs_project_id_idx').on(table.projectId),
]))

export const fileNodes = pgTable('file_nodes', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', {length: 50}).notNull(),
    directory: boolean('directory').default(false).notNull(),
    parentId: uuid('parent_id'),
    position: integer('position').default(0).notNull(),
    editable: boolean('editable').default(true).notNull(), // If you can rename/delete the file itself
    contentEditable: boolean('content_editable').default(true).notNull(), // If you can edit the content of the file
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
    index('file_nodes_name_trgm_idx').using('gin', table.name.op('gin_trgm_ops')),
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
    userId: text('user_id')
      .references(() => user.id, { onDelete: 'cascade' })
      .notNull(),
    title: varchar('title', { length: 255 }).default('New Chat').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
  }, (table) => ([
    index('conversations_project_id_idx').on(table.projectId),
    index('conversations_user_id_idx').on(table.userId),
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
    position: serial('position').notNull(),
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
    pricing: jsonb('pricing').$type<TokenPricing>(),
    enabled: boolean('enabled').default(true).notNull(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('llm_models_provider_api_name_unique').on(table.provider, table.apiName),
  ]))

  export const modelCategories = pgTable('model_categories', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description').notNull(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('model_categories_name_unique').on(table.name),
  ]))

  export const modelsAndCategories = pgTable('models_and_categories', {
    modelId: varchar('model_id', { length: 50 })
      .references(() => llmModels.id, { onDelete: 'cascade' })
      .notNull(),
    categoryId: uuid('category_id')
      .references(() => modelCategories.id, { onDelete: 'cascade' })
      .notNull(),
    ...timestamps,
  }, (table) => ([
  primaryKey({ columns: [table.modelId, table.categoryId] }),
  ]))


  export const modelsOptions = pgTable('models_options', {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    label: varchar('label', { length: 100 }).notNull(),
    description: text('description'),
    options: jsonb('options').$type<ModelOptionType[]>().notNull(),
    default: varchar('default', { length: 100 }),
    active: boolean('active').default(true).notNull(),
    provider: varchar('provider', { length: 50 }).default('generic').notNull(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('models_options_provider_key_unique').on(table.provider, table.key),
  ]))

  export const modelsOptionsAndModels = pgTable('models_options_and_models', {
    optionId: uuid('option_id')
      .references(() => modelsOptions.id, { onDelete: 'cascade' })
      .notNull(),
    modelId: varchar('model_id', { length: 50 })
      .references(() => llmModels.id, { onDelete: 'cascade' })
      .notNull(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('models_options_and_models_option_id_model_id_unique').on(table.optionId, table.modelId),
  ]))


  // ========================= BILLING ==========================

  export const billingReservationStatusEnum = pgEnum('billing_reservation_status', [
    'reserved',
    'settled',
    'refunded',
    'expired',
  ])

  export const billingLedgerKindEnum = pgEnum('billing_ledger_kind', [
    'reserve',
    'settle_diff',
    'refund',
    'topup',
    'expire',
    'overage_uncovered',
  ])

  export const organizationWallets = pgTable('organization_wallets', {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    balance: bigint('balance', { mode: 'bigint' }).default(sql`0`).notNull(),
    ...timestamps,
  })

  export const billingReservations = pgTable('billing_reservations', {
    id: uuid('id').defaultRandom().primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    organizationId: text('organization_id')
      .references(() => organization.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    operation: varchar('operation', { length: 100 }).notNull(),
    estimatedCredits: bigint('estimated_credits', { mode: 'bigint' }).notNull(),
    actualCredits: bigint('actual_credits', { mode: 'bigint' }),
    status: billingReservationStatusEnum('status').default('reserved').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('billing_reservations_idempotency_key_unique').on(table.idempotencyKey),
    index('billing_reservations_status_expires_at_idx').on(table.status, table.expiresAt),
    index('billing_reservations_org_status_idx').on(table.organizationId, table.status),
  ]))

  export const billingLedger = pgTable('billing_ledger', {
    id: uuid('id').defaultRandom().primaryKey(),
    reservationId: uuid('reservation_id').references(() => billingReservations.id, { onDelete: 'set null' }),
    organizationId: text('organization_id')
      .references(() => organization.id, { onDelete: 'cascade' })
      .notNull(),
    delta: bigint('delta', { mode: 'bigint' }).notNull(),
    kind: billingLedgerKindEnum('kind').notNull(),
    balanceAfter: bigint('balance_after', { mode: 'bigint' }).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }, (table) => ([
    uniqueIndex('billing_ledger_idempotency_key_unique').on(table.idempotencyKey),
    index('billing_ledger_org_created_at_idx').on(table.organizationId, table.createdAt),
    index('billing_ledger_reservation_id_idx').on(table.reservationId),
  ]))


// ========================= VIDEO EDITOR ==========================

  export const videoCompositions = pgTable('video_compositions', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    fileNodeId: uuid('file_node_id')
      .references(() => fileNodes.id, { onDelete: 'cascade' }),
    fps: integer('fps').default(30).notNull(),
    durationInFrames: integer('duration_in_frames').default(900).notNull(),
    aspectRatio: varchar('aspect_ratio', { length: 10 }).default('16:9').notNull().$type<AspectRatio>(),
    width: integer('width').default(1920).notNull(),
    height: integer('height').default(1080).notNull(),
    version: integer('version').default(1).notNull(),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('video_compositions_file_node_id_unique').on(table.fileNodeId),
    index('video_compositions_project_id_idx').on(table.projectId),
  ]))

  export const videoTracks = pgTable('video_tracks', {
    id: uuid('id').defaultRandom().primaryKey(),
    compositionId: uuid('composition_id')
      .references(() => videoCompositions.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 50 }).notNull().$type<VideoTrackType>(),
    position: integer('position').default(0).notNull(),
    muted: boolean('muted').default(false).notNull(),
    hidden: boolean('hidden').default(false).notNull(),
    ...timestamps,
  }, (table) => ([
    index('video_tracks_composition_id_position_idx').on(table.compositionId, table.position),
  ]))

  export const videoClips = pgTable('video_clips', {
    id: uuid('id').defaultRandom().primaryKey(),
    trackId: uuid('track_id')
      .references(() => videoTracks.id, { onDelete: 'cascade' })
      .notNull(),
    compositionId: uuid('composition_id')
      .references(() => videoCompositions.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 50 }).notNull().$type<VideoTrackType>(),
    startFrame: integer('start_frame').notNull(),
    endFrame: integer('end_frame').notNull(),
    sourceStartFrame: integer('source_start_frame').default(0).notNull(),
    sourceDurationInFrames: integer('source_duration_in_frames').notNull(),
    assetId: uuid('asset_id')
      .references(() => assets.id, { onDelete: 'set null' }),
    properties: jsonb('properties').$type<VideoClipProperties>().notNull(),
    ...timestamps,
  }, (table) => ([
    index('video_clips_composition_id_start_end_idx').on(table.compositionId, table.startFrame, table.endFrame),
    index('video_clips_track_id_start_frame_idx').on(table.trackId, table.startFrame),
    index('video_clips_composition_id_type_idx').on(table.compositionId, table.type),
    index('video_clips_asset_id_idx').on(table.assetId),
  ]))

// ======================== SKILLS & TEMPLATES ==========================
// Maybe let's have some tags for skills and templates
export const skills = pgTable('skills', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description').notNull(),
    instructions: text('instructions').notNull(),
    fileNodeId: uuid('file_node_id')
      .references(() => fileNodes.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 50 }).notNull().default('draft').$type<TemplateAndSkillStatus>(),
    visibility: varchar('visibility', { length: 50 }).notNull().default('private').$type<TemplateAndSkillVisibility>(),
    ...timestamps,
  }, (table) => ([
    index('skills_visibility_status_idx').on(table.visibility, table.status),
    index('skills_file_node_id_idx').on(table.fileNodeId),
  ]))


export const templates = pgTable('templates', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 150 }).notNull(),
    description: text('description'),
    thumbnail: text('thumbnail'),
    status: varchar('status', {length: 50}).$type<TemplateAndSkillStatus>().default('draft').notNull(),
    visibility: varchar('visibility', { length: 50 }).notNull().default('private').$type<TemplateAndSkillVisibility>(),
    displayPriority: integer('display_priority').default(10_000).notNull(),
    ...timestamps,
  }, (table) => ([
    index('templates_status_idx').on(table.status),
    index('templates_project_id_idx').on(table.projectId),
    uniqueIndex('templates_slug_unique').on(table.slug),
  ]))

export const categories = pgTable('categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 150 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull().$type<CategoryType>(),
  displayPriority: integer('display_priority').default(0).notNull(),
  ...timestamps,
}, (table) => ([
  uniqueIndex('categories_slug_unique').on(table.slug),
  index('categories_type_idx').on(table.type),
]))

export const projectCategories = pgTable('project_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps,
}, (table) => ([
  uniqueIndex('project_categories_project_id_category_id_unique').on(table.projectId, table.categoryId),
]))

export const skillCategories = pgTable('skill_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillId: uuid('skill_id').references(() => skills.id, { onDelete: 'cascade' }).notNull(),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'cascade' }).notNull(),
  ...timestamps,
}, (table) => ([
  uniqueIndex('skill_categories_skill_id_category_id_unique').on(table.skillId, table.categoryId),
]))

// Those are patches that users can approve or reject
export const pendingFileOperations = pgTable('pending_file_operations', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  fileNodeId: uuid('file_node_id').references(() => fileNodes.id, { onDelete: 'cascade' }).notNull(),
  operation: varchar('operation', { length: 50 }).$type<FileOperationType>().notNull(),
  payload: jsonb('payload').$type<FilePendingOperation>().notNull(),
  diffApplied: boolean('diff_applied').default(false).notNull(),
  ...timestamps,
}, (table) => ([
  uniqueIndex('pending_file_operations_file_node_id_unique').on(table.fileNodeId),
  index('pending_file_operations_project_id_idx').on(table.projectId),
]))

// ========================= GENERATION REQUESTS ==========================

// This is the table stores the status of the agent run, it includes the list of messages generated and the status of the run
export const conversationAgentRuns = pgTable('conversation_agent_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending').$type<AgentRunStatus>(),
  messages: jsonb('messages').notNull().$type<AgentRunMessage[]>(),
  metadata: jsonb('metadata').$type<AgentRunMetadata>(),
  error: text('error'),
  ...timestamps,
}, (table) => ([
  index('conversation_agent_runs_project_id_status_idx').on(table.projectId, table.status),
  index('conversation_agent_runs_conversation_id_created_at_idx').on(table.conversationId, table.createdAt),
]))


export const assetsAgentRuns = pgTable('assets_agent_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('pending').$type<AgentRunStatus>(),
  messages: jsonb('messages').$type<AgentRunMessage[]>(),
  metadata: jsonb('metadata').$type<{settings: Record<string, unknown>}>(),
  error: text('error'),
  ...timestamps,
}, (table) => ([
  index('assets_agent_runs_project_id_status_idx').on(table.projectId, table.status),
]))


  // ========================= ASSETS ==========================

  export const assets = pgTable('assets', {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 50 }).notNull().$type<AssetType>(),
    url: text('url').notNull(),
    storageKey: text('storage_key').notNull(),
    source: varchar('source', { length: 50 }).notNull().$type<AssetSource>(),
    generationRequestId: uuid('generation_request_id')
      .references(() => assetsAgentRuns.id, { onDelete: 'set null' }), // for AI generated assets
    fileNodeId: uuid('file_node_id')
      .references(() => fileNodes.id, { onDelete: 'cascade' }),
    metadata: jsonb('metadata').$type<AssetMetadata>(),
    ...timestamps,
  }, (table) => ([
    index('assets_project_type_created_at_idx').on(
      table.projectId,
      table.type,
      table.createdAt,
    ),
    index('assets_project_source_created_at_idx').on(
      table.projectId,
      table.source,
      table.createdAt,
    ),
    index('assets_generation_request_id_idx').on(table.generationRequestId)
  ]))

  export const assetsAgentRunsRelations = relations(assetsAgentRuns, ({ many }) => ({
    assets: many(assets),
  }))

  export const assetsRelations = relations(assets, ({ one }) => ({
    generationRequest: one(assetsAgentRuns, {
      fields: [assets.generationRequestId],
      references: [assetsAgentRuns.id],
    }),
  }))

  export const commands = pgTable('commands', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    action: text('action').notNull(),
    isPublic: boolean('is_public').default(false).notNull(),
    visible: boolean('visible').default(false).notNull(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    ...timestamps,
  }, (table) => ([
    index('commands_project_id_idx').on(table.projectId),
    uniqueIndex('commands_name_project_unique').on(table.name, table.projectId),
  ]))

  export const assetVariants = pgTable('asset_variants', {
    id: uuid('id').defaultRandom().primaryKey(),
    assetId: uuid('asset_id')
      .references(() => assets.id, { onDelete: 'cascade' })
      .notNull(),
    type: varchar('type', { length: 50 }).notNull().$type<AssetVariantType>(),
    storageKey: varchar('storage_key', { length: 255 }).notNull(),
    url: text('url').notNull(),
    metadata: jsonb('metadata').$type<AssetMetadata>(),
    size: integer('size').notNull(),
    status: varchar('status', { length: 50 }).notNull().$type<AssetStatus>(),
    blurhash: text('blurhash'),
    ...timestamps,
  }, (table) => ([
    uniqueIndex('asset_variants_asset_id_type_unique').on(table.assetId, table.type),
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
  export type Asset = typeof assets.$inferSelect
  export type AssetVariant = typeof assetVariants.$inferSelect
  export type OrganizationWallet = typeof organizationWallets.$inferSelect
  export type BillingReservation = typeof billingReservations.$inferSelect
  export type BillingLedgerEntry = typeof billingLedger.$inferSelect
  export type BillingReservationStatus = (typeof billingReservationStatusEnum.enumValues)[number]
  export type BillingLedgerKind = (typeof billingLedgerKindEnum.enumValues)[number]
  export type VideoComposition = typeof videoCompositions.$inferSelect
  export type VideoTrack = typeof videoTracks.$inferSelect
  export type VideoClip = typeof videoClips.$inferSelect
  export type Template = typeof templates.$inferSelect
  export type PendingFileOperation = typeof pendingFileOperations.$inferSelect
  export type Skill = typeof skills.$inferSelect
  export type ConversationAgentRun = typeof conversationAgentRuns.$inferSelect
  export type AssetsAgentRun = typeof assetsAgentRuns.$inferSelect
  export type Command = typeof commands.$inferSelect
