import { t } from 'elysia'

// ============================================================================
// DTOs for API requests/responses
// ============================================================================


// Update conversation input
export const UpdateConversationDTO = t.Object({
  title: t.Optional(t.String()),
})

// Conversation response
export const ConversationDTO = t.Object({
  id: t.String(),
  projectId: t.String(),
  title: t.String(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

// Context item schema
export const ContextItemDTO = t.Object({
  blocks: t.Array(t.String()),
  selections: t.Array(t.String()),
})

// Message input
export const CreateMessageDTO = t.Object({
  conversationId: t.Union([t.String({ format: 'uuid' }), t.Null()]),
  prompt: t.String(),
  context: t.Optional(ContextItemDTO),
  selectedModel: t.Optional(t.String()),
})

// Reply user message input
export const ReplyUserMessageDTO = t.Object({
  prompt: t.String(),
  context: t.Optional(ContextItemDTO),
  conversationId: t.Union([t.String({ format: 'uuid' }), t.Null()]),
  selectedModel: t.Optional(t.String()),
})


// ============================================================================
// TypeScript types (inferred from schemas)
// ============================================================================

export type ContextItem = typeof ContextItemDTO.static
export type UpdateConversation = typeof UpdateConversationDTO.static
export type CreateMessage = typeof CreateMessageDTO.static
export type ConversationResponse = typeof ConversationDTO.static
export type ReplyUserMessage = typeof ReplyUserMessageDTO.static
