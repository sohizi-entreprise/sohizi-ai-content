import { chatRepo } from '@/entities/chat'
import type { CreateMessage, ReplyUserMessage } from '@/entities/chat/model'
import { AgentEvent } from '../ai/editor-agent/types';
import { projectRepo } from '@/entities/project';
import { ResumableStream, redis, type StreamEvent } from "@/lib";
import { NotFound } from '../error';
import { EditorAgent } from '../ai/editor-agent';
import { ToolModelMessage, ToolResultPart, AssistantModelMessage } from 'ai';
import { CursorPaginationOptions } from '@/type';
import { Conversation } from '@/db/schema';
import { RunPayload } from '../ai/editor-agent/editor-agent';

// ============================================================================
// CONVERSATIONS
// ============================================================================

export const createConversation = async (projectId: string, title?: string) => {
  await validateProject(projectId);
  return await chatRepo.createConversation(projectId, title);
}

export const getProjectConversations = async (projectId: string, options?: CursorPaginationOptions) => {
  await validateProject(projectId);
  return await chatRepo.listConversations(projectId, options);
}

export const deleteConversation = async (id: string) => {
  await validateConversation(id);
  const deleted = await chatRepo.deleteConversation(id);
  return { confirmed: deleted };
}

// ============================================================================
// MESSAGES
// ============================================================================

export const getConversationMessages = async (conversationId: string, options?: CursorPaginationOptions) => {
  await validateConversation(conversationId);
  return await chatRepo.ListMessagesByConversationId(conversationId, options);
}

export const getConversationAgentRuns = async (conversationId: string, options?: CursorPaginationOptions) => {
  await validateConversation(conversationId);
  return await chatRepo.ListAgentRunsWithMessages(conversationId, options);
}

export const replyUserMessage = async (data: ReplyUserMessage, projectId: string) => {
  const project =await validateProject(projectId);

  let conversationId: string = data.conversationId ?? '';
  let conversation: Conversation;
  if(conversationId) {
    conversation = await validateConversation(conversationId);
  }else{
    // Create a new conversation
    conversation = await chatRepo.createConversation(projectId);
    conversationId = conversation.id;
  }
  // Create a new agent run
  const {id: runId} = await chatRepo.createAgentRun(conversationId, data.selectedModel);

  // Save the user message
  const userMessage = await chatRepo.createMessage({
    conversationId,
    runId,
    role: 'user',
    content: [{type:'text', text: data.prompt}],
    context: data.context
  });

  // We fire and forget the request to the editor agent
  runEditorAgent({
    model: data.selectedModel || 'gpt-5-mini',
    reasoningEffort: 'medium',
    projectId: project.id,
    conversationId: conversationId,
    runId: runId,
    editComponent: 'synopsis'
  })

  return {
    success: true,
    streamId: conversationId,
    runId: runId,
    userMessageId: userMessage.id,
    conversation
  };
}

// ============================================================================
// HELPERS
// ============================================================================

async function validateConversation(conversationId: string) {
  const conversation = await chatRepo.getConversationById(conversationId);
  if (!conversation) {
    throw new NotFound('Conversation not found');
  }
  return conversation;
}

async function validateProject(projectId: string) {
  const project = await projectRepo.getProjectById(projectId);
  if (!project) {
    throw new NotFound('Project not found');
  }
  return project;
}

async function runEditorAgent(params: RunPayload & {model: string, reasoningEffort: 'low' | 'medium' | 'high'}){
  const {model, reasoningEffort, ...payload} = params;
  const stream = new ResumableStream<AgentEvent>(redis, params.conversationId);
  const abortController = new AbortController()
  let isDone = false
  const editorAgent = new EditorAgent({
    model: model,
    reasoningEffort: reasoningEffort,
  })

  const cancellationWatcher = (async () => {
    while (!isDone && !abortController.signal.aborted) {
      if (await stream.isCancelled()) {
        abortController.abort()
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  })()

  try {
    for await (const event of editorAgent.run({
      payload,
      onSuccess: async () => {},
      onError: async () => {},
      onAbort: async () => {},
      onUsageUpdate: async () => {},
      abortSignal: abortController.signal,
    })) {
      await stream.push(toConversationStreamEvent(event))
    }
  } finally {
    isDone = true
    await cancellationWatcher.catch(() => {})
    await stream.close()
  }
}

function toConversationStreamEvent(event: AgentEvent): StreamEvent<AgentEvent> {
  switch (event.type) {
    case 'start':
      return { type: 'editor_start', data: event }
    case 'end':
      return { type: 'editor_end', data: event }
    case 'error':
      return { type: 'editor_error', data: event }
    case 'reasoning_delta':
      return { type: 'editor_reasoning', data: event }
    case 'editor_operation':
      return { type: 'editor_operation', data: event }
    default:
      return { type: 'editor_delta', data: event }
  }
}
