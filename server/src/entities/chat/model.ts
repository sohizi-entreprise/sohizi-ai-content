import { t } from 'elysia'

// ============================================================================
// DTOs for API requests/responses
// ============================================================================

// Context item schema
export const ContextItemDTO = t.Object({
  id: t.String(),
  type: t.Union([
    t.Literal('selection'),
    t.Literal('character'),
    t.Literal('location'),
    t.Literal('scene'),
  ]),
  label: t.String(),
  content: t.String(),
  metadata: t.Optional(t.Record(t.String(), t.Unknown())),
})

// Mention item schema
export const MentionItemDTO = t.Object({
  id: t.String(),
  type: t.Union([t.Literal('character'), t.Literal('location')]),
  name: t.String(),
  description: t.Optional(t.String()),
})

// Create conversation input
export const CreateConversationDTO = t.Object({
  projectId: t.String({ format: 'uuid' }),
  editorType: t.Union([
    t.Literal('synopsis'),
    t.Literal('script'),
    t.Literal('bible'),
    t.Literal('outline'),
  ]),
  title: t.Optional(t.String()),
})

// Update conversation input
export const UpdateConversationDTO = t.Object({
  title: t.Optional(t.String()),
})

// Conversation response
export const ConversationDTO = t.Object({
  id: t.String(),
  projectId: t.String(),
  title: t.String(),
  editorType: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
})

// Message input
export const CreateMessageDTO = t.Object({
  content: t.String(),
  context: t.Optional(t.Array(ContextItemDTO)),
  mentions: t.Optional(t.Array(MentionItemDTO)),
})

// Message response
export const MessageDTO = t.Object({
  id: t.String(),
  conversationId: t.String(),
  role: t.Union([
    t.Literal('user'),
    t.Literal('assistant'),
    t.Literal('system'),
  ]),
  content: t.String(),
  context: t.Optional(t.Array(ContextItemDTO)),
  mentions: t.Optional(t.Array(MentionItemDTO)),
  createdAt: t.String(),
})

// List conversations response
export const ConversationListDTO = t.Array(ConversationDTO)

// Messages list response
export const MessageListDTO = t.Array(MessageDTO)

// ============================================================================
// TypeScript types (inferred from schemas)
// ============================================================================

export type ContextItem = typeof ContextItemDTO.static
export type MentionItem = typeof MentionItemDTO.static
export type CreateConversation = typeof CreateConversationDTO.static
export type UpdateConversation = typeof UpdateConversationDTO.static
export type CreateMessage = typeof CreateMessageDTO.static
export type ConversationResponse = typeof ConversationDTO.static
export type MessageResponse = typeof MessageDTO.static
