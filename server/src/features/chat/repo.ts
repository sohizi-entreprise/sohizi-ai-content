import { db } from "@/db";
import { conversations, messages, checkpoints, llmModels, modelsAndCategories, modelCategories, conversationAgentRuns, modelsOptions, modelsOptionsAndModels } from "@/db/schema";
import { eq, desc, and, lt, arrayContains, inArray } from "drizzle-orm";
import { AgentRunMessage, AgentRunMetadata, AgentRunStatus, AgentState, CursorPaginationOptions, CursorPaginationResult, MsgContent } from "@/type";
import { ModelMessage, UserModelMessage } from "ai";


// ============================================================================
// CONVERSATIONS
// ============================================================================

export const createConversation = async (projectId: string, userId: string, title: string = 'New Chat') => {
  const result = await db.insert(conversations).values({
    projectId,
    userId,
    title
  }).returning();
  return result[0];
}

type conversationWithAgentRunPayload = {
  projectId: string;
  userId: string
  userMsg: UserModelMessage & { id: string }
}

export const updateConversationAgentRun = async(runId: string, data: { status?: AgentRunStatus, metadata?: AgentRunMetadata, error?: string, messages?: AgentRunMessage[] }) => {
  const result = await db.update(conversationAgentRuns).set({
    ...data,
  }).where(eq(conversationAgentRuns.id, runId)).returning();
  return result[0];
}

export const appendConversationAgentRunMessages = async(runId: string, messages: AgentRunMessage[]) => {
  return await db.transaction(async (tx) => {
    const response = await tx.select().from(conversationAgentRuns).where(eq(conversationAgentRuns.id, runId));
    const agentRun = response[0];
    if(!agentRun) {
      throw new Error('Agent run not found');
    }
    const newMessages = [...agentRun.messages, ...messages];
    const result = await tx.update(conversationAgentRuns).set({
      messages: newMessages,
    }).where(eq(conversationAgentRuns.id, runId)).returning();
    return result[0];
  })
}

export const createConversationComponents = async(payload: conversationWithAgentRunPayload) => {
  const { projectId, userId, userMsg } = payload;
  return await db.transaction(async (tx) => {
    const convResponse = await tx.insert(conversations).values({
      projectId,
      userId,
      title: 'New chat'
    }).returning();
    const conversation = convResponse[0];
    const checkpointResponse = await tx.insert(checkpoints).values({
      projectId,
      conversationId: conversation.id
    }).returning();
    const checkpoint = checkpointResponse[0];
    const agentRunResponse = await tx.insert(conversationAgentRuns).values({
      projectId,
      conversationId: conversation.id,
      messages: [userMsg],
    }).returning();
    const agentRun = agentRunResponse[0];
    return {
      conversation,
      checkpoint,
      agentRun
    };
  });
}

export const createConversationRun = async(payload: Omit<conversationWithAgentRunPayload, 'userId'> & { conversationId: string }) => {
  const { projectId, conversationId, userMsg } = payload;
  const response = await db.insert(conversationAgentRuns).values({
    projectId,
    conversationId,
    messages: [userMsg],
  }).returning();
  return response[0];
}


export const createConversationWithCheckpoint = async (projectId: string, userId: string, title: string = 'New Chat') => {
  return await db.transaction(async (tx) => {
    const convResponse = await tx.insert(conversations).values({
      projectId,
      userId,
      title
    }).returning();
    const conversation = convResponse[0];
    const checkpointResponse = await tx.insert(checkpoints).values({
      projectId,
      conversationId: conversation.id
    }).returning();
    const checkpoint = checkpointResponse[0];
    return {
      conversation,
      checkpoint
    };
  });
}

export const getConversationById = async (id: string) => {
  const result = await db.select().from(conversations).where(eq(conversations.id, id));
  return result[0];
}

export type ListConversationsResult = CursorPaginationResult<typeof conversations.$inferSelect>;

const DEFAULT_CONVERSATIONS_PAGE_SIZE = 20;
const MAX_CONVERSATIONS_PAGE_SIZE = 100;

export const listConversations = async (
  projectId: string,
  userId: string,
  options?: CursorPaginationOptions
): Promise<ListConversationsResult> => {
  const limit = Math.min(
    options?.limit ?? DEFAULT_CONVERSATIONS_PAGE_SIZE,
    MAX_CONVERSATIONS_PAGE_SIZE
  );
  const cursor = options?.cursor;

  const baseConditions = cursor
    ? and(
        eq(conversations.projectId, projectId),
        eq(conversations.userId, userId),
        lt(conversations.updatedAt, new Date(cursor))
      )
    : and(
        eq(conversations.projectId, projectId),
        eq(conversations.userId, userId)
      );

  const rows = await db
    .select()
    .from(conversations)
    .where(baseConditions)
    .orderBy(desc(conversations.updatedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor =
    hasMore && page.length > 0 ? page[page.length - 1].updatedAt.toISOString() : null;

  return {
    data: page,
    nextCursor,
    hasMore,
  };
}

export const updateConversation = async (id: string, data: { title?: string }) => {
  const result = await db
    .update(conversations)
    .set({
      ...data,
    })
    .where(eq(conversations.id, id))
    .returning();
  return result[0];
}

export const deleteConversation = async (id: string) => {
  const result = await db
    .delete(conversations)
    .where(eq(conversations.id, id))
    .returning({ id: conversations.id });
  return result.length > 0;
}

// ============================================================================
// AGENT RUNS
// ============================================================================

export const insertCheckpoint = async (projectId: string, conversationId: string, state: AgentState | null) => {
  const result = await db.insert(checkpoints).values({
    projectId,
    conversationId,
    state
  }).onConflictDoUpdate({
    target: [checkpoints.projectId, checkpoints.conversationId],
    set: {
      state,
    },
  }).returning();

  return result[0];
}

export const getCheckpoint = async (projectId: string, conversationId: string) => {
  const result = await db.select().from(checkpoints).where(and(eq(checkpoints.projectId, projectId), eq(checkpoints.conversationId, conversationId)));
  return result[0];
}


// ============================================================================
// MESSAGES
// ============================================================================

export type CreateMessageData = {
  role: 'user' | 'assistant' | 'tool',
  content: MsgContent,
}

export const createMessage = async (conversationId: string, payload: CreateMessageData) => {
  const result = await db.insert(messages).values({
    conversationId,
    ...payload
  }).returning();
  return result[0];
}

export const createMessagesBulk = async (conversationId: string, payloads: CreateMessageData[]) => {
  if (payloads.length === 0) return [];
  const values = payloads.map(payload => ({
    conversationId,
    ...payload
  }));
  const result = await db.insert(messages).values(values).returning();
  return result;
}

export type ListMessagesByConversationIdResult = CursorPaginationResult<typeof messages.$inferSelect>;
export type ListConversationAgentRunsResult = CursorPaginationResult<typeof conversationAgentRuns.$inferSelect>;

const DEFAULT_MESSAGES_PAGE_SIZE = 20;
const MAX_MESSAGES_PAGE_SIZE = 50;

export const ListMessagesByConversationId = async (
  conversationId: string,
  options?: CursorPaginationOptions
): Promise<ListMessagesByConversationIdResult> => {
  const limit = Math.min(options?.limit ?? DEFAULT_MESSAGES_PAGE_SIZE, MAX_MESSAGES_PAGE_SIZE);
  const cursor = options?.cursor;

  const rows = await db
    .select()
    .from(messages)
    .where(
      cursor
        ? and(
            eq(messages.conversationId, conversationId),
            lt(messages.position, Number(cursor))
          )
        : eq(messages.conversationId, conversationId)
    )
    .orderBy(desc(messages.position))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const nextCursor =
    hasMore && page.length > 0 ? String(page[0].position) : null;

  return { data: page, nextCursor, hasMore };
}

export const listConversationAgentRuns = async (
  conversationId: string,
  options?: CursorPaginationOptions
): Promise<ListConversationAgentRunsResult> => {
  const limit = Math.min(options?.limit ?? DEFAULT_MESSAGES_PAGE_SIZE, MAX_MESSAGES_PAGE_SIZE);
  const cursor = options?.cursor;

  const rows = await db
    .select()
    .from(conversationAgentRuns)
    .where(
      cursor
        ? and(
            eq(conversationAgentRuns.conversationId, conversationId),
            lt(conversationAgentRuns.createdAt, new Date(cursor))
          )
        : eq(conversationAgentRuns.conversationId, conversationId)
    )
    .orderBy(desc(conversationAgentRuns.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  const nextCursor =
    hasMore && page.length > 0 ? String(page[0].createdAt.toISOString()) : null;

  return { data: page, nextCursor, hasMore };
}

export const listLlmModels = async (categories: string[]) => {
  const result = await db.select({
                          id: llmModels.id,
                          name: llmModels.name,
                          provider: llmModels.provider,
                        })
                         .from(llmModels)
                         .leftJoin(modelsAndCategories, eq(llmModels.id, modelsAndCategories.modelId))
                         .leftJoin(modelCategories, eq(modelsAndCategories.categoryId, modelCategories.id))
                         .where(and(inArray(modelCategories.name, categories), eq(llmModels.enabled, true)))
                         .limit(20);
  return result;
}


export const getModelById = async (id: string) => {
  const result = await db.select().from(llmModels).where(eq(llmModels.id, id));
  return result[0];
}

export const listModelOptions = async (modelId: string) => {
  const result = await db.select({
                            key: modelsOptions.key,
                            label: modelsOptions.label,
                            description: modelsOptions.description,
                            options: modelsOptions.options,
                            default: modelsOptions.default,
                        })
                         .from(modelsOptions)
                         .innerJoin(
                          modelsOptionsAndModels, 
                          and(eq(modelsOptions.id, modelsOptionsAndModels.optionId), eq(modelsOptionsAndModels.modelId, modelId))
                         )
                         .where(eq(modelsOptions.active, true));
  return result;
}