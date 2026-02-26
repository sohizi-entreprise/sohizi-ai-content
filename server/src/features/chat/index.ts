import { Elysia, t } from 'elysia'
import { chatModel } from '@/entities/chat'
import * as chatService from './service'

export const chatRoutes = new Elysia({ prefix: '/chat' })
  // ============================================================================
  // CONVERSATIONS
  // ============================================================================
  
  // Create a new conversation
  .post('/conversations', ({ body }) => {
    return chatService.createConversation(body);
  }, {
    body: chatModel.CreateConversationDTO,
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Get conversations for a project
  .get('/conversations/project/:projectId', ({ params, query }) => {
    return chatService.getProjectConversations(params.projectId, query.editorType);
  }, {
    params: t.Object({
      projectId: t.String({ format: 'uuid' }),
    }),
    query: t.Object({
      editorType: t.Optional(t.String()),
    }),
    response: {
      200: chatModel.ConversationListDTO,
    },
  })
  
  // Get a specific conversation
  .get('/conversations/:id', ({ params }) => {
    return chatService.getConversation(params.id);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Update a conversation
  .put('/conversations/:id', ({ params, body }) => {
    return chatService.updateConversation(params.id, body);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    body: chatModel.UpdateConversationDTO,
    response: {
      200: chatModel.ConversationDTO,
    },
  })
  
  // Delete a conversation
  .delete('/conversations/:id', ({ params }) => {
    return chatService.deleteConversation(params.id);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: t.Object({ confirmed: t.Boolean() }),
    },
  })
  
  // ============================================================================
  // MESSAGES
  // ============================================================================
  
  // Get messages for a conversation
  .get('/conversations/:id/messages', ({ params }) => {
    return chatService.getConversationMessages(params.id);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    response: {
      200: chatModel.MessageListDTO,
    },
  })
  
  // Send a message to a conversation
  .post('/conversations/:id/messages', ({ params, body }) => {
    return chatService.sendMessage(params.id, body);
  }, {
    params: t.Object({
      id: t.String({ format: 'uuid' }),
    }),
    body: chatModel.CreateMessageDTO,
    response: {
      200: t.Object({
        userMessage: chatModel.MessageDTO,
        assistantMessage: chatModel.MessageDTO,
      }),
    },
  })
