import { db } from "@/db";
import { conversations, messages, agent_runs } from "@/db/schema";
import { eq, desc, asc, and, lt, gt } from "drizzle-orm";
import { AgentRunFinishReason, ChatMetadata, CursorPaginationOptions, CursorPaginationResult, MsgContent, MsgContext, MsgMetadata } from "@/type";
import type { Message } from "@/db/schema";


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

export const createAgentRun = async (conversationId: string, selectedModel: string='default') => {
  const metadata = {
      spentTokens: {
          input: 0,
          output: 0
      },
      selectedModel
  }

  const result = await db.insert(agent_runs).values({
    conversationId,
    metadata
  }).returning({ id: agent_runs.id });
  return result[0];
}

export const listAgentRuns = async (conversationId: string) => {
  const result = await db
    .select()
    .from(agent_runs)
    .where(eq(agent_runs.conversationId, conversationId))
    .orderBy(desc(agent_runs.createdAt));
  return result;
}

export type AgentRunWithMessages = {
  runId: string;
  finishReason: AgentRunFinishReason;
  error: string | null;
  metadata: ChatMetadata | null;
  messages: Message[];
};

export type ListAgentRunsWithMessagesResult = CursorPaginationResult<AgentRunWithMessages>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const ListAgentRunsWithMessages = async (
  conversationId: string,
  options?: CursorPaginationOptions
): Promise<ListAgentRunsWithMessagesResult> => {
  const limit = Math.min(options?.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const cursor = options?.cursor;

  const runs = await db.query.agent_runs.findMany({
    where: cursor
      ? and(
          eq(agent_runs.conversationId, conversationId),
          lt(agent_runs.createdAt, new Date(cursor))
        )
      : eq(agent_runs.conversationId, conversationId),
    orderBy: desc(agent_runs.createdAt),
    limit: limit + 1,
    with: {
      messages: {
        orderBy: asc(messages.createdAt),
      },
    },
  });

  const hasMore = runs.length > limit;
  const page = runs.slice(0, limit);
  const nextCursor = hasMore && page.length > 0
    ? page[page.length - 1].createdAt.toISOString()
    : null;

  return {
    data: page.map((run) => ({
      runId: run.id,
      finishReason: run.finishReason,
      error: run.error,
      metadata: run.metadata,
      messages: run.messages ?? [],
    })),
    nextCursor,
    hasMore,
  };
}

export type UpdateAgentRunData = {
  error?: string,
  metadata?: ChatMetadata
  finishReason?: AgentRunFinishReason
}

export const updateAgentRun = async (id: string, data: UpdateAgentRunData) => {
  const result = await db
    .update(agent_runs)
    .set({
      ...data,
    })
    .where(eq(agent_runs.id, id))
    .returning();
  return result[0];
}

// ============================================================================
// MESSAGES
// ============================================================================

export type CreateMessageData = {
  conversationId: string,
  runId: string,
  role: 'user' | 'assistant' | 'tool',
  content: MsgContent[],
  context?: MsgContext,
  metadata?: MsgMetadata
}

export const createMessage = async (payload: CreateMessageData) => {
  const result = await db.insert(messages).values(payload).returning();
  return result[0];
}

export const createMessagesBulk = async (payloads: CreateMessageData[]) => {
  if (payloads.length === 0) return [];
  const result = await db.insert(messages).values(payloads).returning();
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
