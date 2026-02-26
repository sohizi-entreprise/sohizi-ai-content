import { chatRepo } from '@/entities/chat'
import type { CreateConversation, CreateMessage } from '@/entities/chat/model'

// ============================================================================
// CONVERSATIONS
// ============================================================================

export const createConversation = async (data: CreateConversation) => {
  const conversation = await chatRepo.createConversation(data);
  return formatConversation(conversation);
}

export const getConversation = async (id: string) => {
  const conversation = await chatRepo.getConversationById(id);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  return formatConversation(conversation);
}

export const getProjectConversations = async (projectId: string, editorType?: string) => {
  const conversations = await chatRepo.getConversationsByProjectId(projectId, editorType);
  return conversations.map(formatConversation);
}

export const updateConversation = async (id: string, data: { title?: string }) => {
  const conversation = await chatRepo.updateConversation(id, data);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  return formatConversation(conversation);
}

export const deleteConversation = async (id: string) => {
  const deleted = await chatRepo.deleteConversation(id);
  return { confirmed: deleted };
}

// ============================================================================
// MESSAGES
// ============================================================================

export const getConversationMessages = async (conversationId: string) => {
  const messages = await chatRepo.getMessagesByConversationId(conversationId);
  return messages.map(formatMessage);
}

export const sendMessage = async (conversationId: string, data: CreateMessage) => {
  // Create user message
  const userMessage = await chatRepo.createMessage(
    conversationId,
    'user',
    data.content,
    data.context,
    data.mentions
  );

  // Generate AI response
  // TODO: Integrate with AI service for actual response generation
  const aiResponse = await generateAIResponse(conversationId, data.content, data.context);
  
  // Create assistant message
  const assistantMessage = await chatRepo.createMessage(
    conversationId,
    'assistant',
    aiResponse
  );

  return {
    userMessage: formatMessage(userMessage),
    assistantMessage: formatMessage(assistantMessage),
  };
}

// Placeholder for AI response generation
// This will be replaced with actual AI integration
async function generateAIResponse(
  conversationId: string,
  userContent: string,
  context?: any[]
): Promise<string> {
  // TODO: Integrate with your AI service
  // For now, return a placeholder response
  const contextInfo = context && context.length > 0 
    ? `\n\nI see you've provided ${context.length} context item(s).`
    : '';

  return `I understand you're asking about: "${userContent.slice(0, 100)}..."${contextInfo}

This is a placeholder response. The actual AI integration will be implemented to provide contextual assistance for your content.`;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatConversation(conversation: any) {
  return {
    id: conversation.id,
    projectId: conversation.projectId,
    title: conversation.title,
    editorType: conversation.editorType,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function formatMessage(message: any) {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role,
    content: message.content,
    context: message.context || undefined,
    mentions: message.mentions || undefined,
    createdAt: message.createdAt.toISOString(),
  };
}
