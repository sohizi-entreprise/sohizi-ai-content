import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { CreateConversation, CreateMessage, ContextItem, MentionItem } from "./model";

// ============================================================================
// CONVERSATIONS
// ============================================================================

export const createConversation = async (data: CreateConversation) => {
  const result = await db.insert(conversations).values({
    projectId: data.projectId,
    editorType: data.editorType,
    title: data.title || 'New Chat',
  }).returning();
  return result[0];
}

export const getConversationById = async (id: string) => {
  const result = await db.select().from(conversations).where(eq(conversations.id, id));
  return result[0];
}

export const getConversationsByProjectId = async (projectId: string, editorType?: string) => {
  const conditions = [eq(conversations.projectId, projectId)];
  
  if (editorType) {
    conditions.push(eq(conversations.editorType, editorType as any));
  }
  
  const result = await db
    .select()
    .from(conversations)
    .where(and(...conditions))
    .orderBy(desc(conversations.updatedAt));
  
  return result;
}

export const updateConversation = async (id: string, data: { title?: string }) => {
  const result = await db
    .update(conversations)
    .set({
      ...data,
      updatedAt: new Date(),
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
// MESSAGES
// ============================================================================

export const createMessage = async (
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  context?: ContextItem[],
  mentions?: MentionItem[]
) => {
  const result = await db.insert(messages).values({
    conversationId,
    role,
    content,
    context: context || null,
    mentions: mentions || null,
  }).returning();

  // Update conversation's updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return result[0];
}

export const getMessagesByConversationId = async (conversationId: string) => {
  const result = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
  
  return result;
}

export const getMessageById = async (id: string) => {
  const result = await db.select().from(messages).where(eq(messages.id, id));
  return result[0];
}

export const updateMessage = async (id: string, content: string) => {
  const result = await db
    .update(messages)
    .set({ content })
    .where(eq(messages.id, id))
    .returning();
  return result[0];
}

export const deleteMessage = async (id: string) => {
  const result = await db
    .delete(messages)
    .where(eq(messages.id, id))
    .returning({ id: messages.id });
  return result.length > 0;
}
