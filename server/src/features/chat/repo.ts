import { db } from "@/db";
import { conversations, messages, checkpoints, llmModels } from "@/db/schema";
import { eq, desc, asc, and, lt, gt, arrayContains } from "drizzle-orm";
import { AgentState, CursorPaginationOptions, CursorPaginationResult, MsgContent } from "@/type";


// ============================================================================
// CONVERSATIONS
// ============================================================================

export const createConversation = async (projectId: string, title: string = 'New Chat') => {
  const result = await db.insert(conversations).values({
    projectId,
    title
  }).returning();
  return result[0];
}

export const createConversationWithCheckpoint = async (projectId: string, title: string = 'New Chat') => {
  return await db.transaction(async (tx) => {
    const convResponse = await tx.insert(conversations).values({
      projectId,
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
  options?: CursorPaginationOptions
): Promise<ListConversationsResult> => {
  const limit = Math.min(
    options?.limit ?? DEFAULT_CONVERSATIONS_PAGE_SIZE,
    MAX_CONVERSATIONS_PAGE_SIZE
  );
  const cursor = options?.cursor;

  const rows = await db
    .select()
    .from(conversations)
    .where(
      cursor
        ? and(
            eq(conversations.projectId, projectId),
            lt(conversations.updatedAt, new Date(cursor))
          )
        : eq(conversations.projectId, projectId)
    )
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

const DEFAULT_MESSAGES_PAGE_SIZE = 20;
const MAX_MESSAGES_PAGE_SIZE = 100;

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
            gt(messages.createdAt, new Date(cursor))
          )
        : eq(messages.conversationId, conversationId)
    )
    .orderBy(asc(messages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const nextCursor =
    hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null;

  return {
    data: page,
    nextCursor,
    hasMore,
  };
}

export const listModelsForLeadAgent = async () => {
  const result = await db
    .select({
      id: llmModels.id,
      name: llmModels.name,
      provider: llmModels.provider,
    })
    .from(llmModels)
    .where(and(arrayContains(llmModels.recommendedUsage, ['lead-agent']), eq(llmModels.enabled, true)))
    .limit(20);
  return result;
}


export const getModelById = async (id: string) => {
  const result = await db.select().from(llmModels).where(eq(llmModels.id, id));
  return result[0];
}