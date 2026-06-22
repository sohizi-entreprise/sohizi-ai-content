import { CursorPaginationOptions } from '@/type';
import * as repo from './repo'

export const listConversations = async (projectId: string, userId: string, options?: CursorPaginationOptions) => {
  const conversations = await repo.listConversations(projectId, userId, options);
  return conversations;
}

export const listMessages = async (conversationId: string, options?: CursorPaginationOptions) => {
  const messages = await repo.ListMessagesByConversationId(conversationId, options);
  return messages;
}

export const deleteConversation = async (id: string) => {
  const result = await repo.deleteConversation(id);
  return {ok: result, error: result ? null : 'Failed to delete conversation'};
}

export const listLlmModels = async (category: string) => {
  const models = await repo.listLlmModels(category);
  return models;
}



