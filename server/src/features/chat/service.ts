import { CursorPaginationOptions } from '@/type';
import * as repo from './repo'
import { z } from 'zod';
import { UserModelMessage, userModelMessageSchema } from 'ai';
import { assertConversationOwner } from '@/lib/authorize';
import { Conversation, ConversationAgentRun, LlmModel } from '@/db/schema';
import { BadRequest } from '../error';
import { Session } from '../ai/agent/core/session';
import { v4 as uuidv4 } from 'uuid';
import { CheckpointPersistence } from '../ai/agent/core/persistence';
import { Agent } from '../ai/agent/core/agent';
import { getAgentDefinition } from '../ai/agent/core/agent-registry';
import { generateTitle } from '../ai/agent/utils/generate-title';
import { broadcastCancellation, createCancellableController } from '../generation-request/abort-manager';
import { BaseStreamData, markStreamActive, readStreamChunks, removeStreamActive, writeStreamData } from '../generation-request/stream-handler';
import { getProjectById } from '../project/repo';
import { sse } from 'elysia';

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

export const listLlmModels = async (categories: string[]) => {
  const models = await repo.listLlmModels(categories);
  return models;
}

export const listConversationAgentRuns = async (conversationId: string, options?: CursorPaginationOptions) => {
  const agentRuns = await repo.listConversationAgentRuns(conversationId, options);
  return agentRuns;
}

export const completionSchema = z.object({
  conversationId: z.uuid('Invalid conversation id').nullable(),
  modelId: z.string('Invalid model id'),
  userPrompt: userModelMessageSchema,
  editorContext: z.record(z.string(), z.any()).optional(),
})

export const cancelRun = async (runId: string) => {
  try {
    await broadcastCancellation(runId);
    await repo.updateConversationAgentRun(runId, { status: 'finished' });
    await removeStreamActive(runId);
    return {ok: true, error: null};
    
  } catch (error) {
    console.error(error);
    return {ok: false, error: error instanceof Error ? error.message : 'Failed to cancel run'};
  }
}

export async function* getStreams(runId: string) {
  for await (const chunk of readStreamChunks(runId)) {
    const data = chunk.data as BaseStreamData;
    yield sse({
      id: chunk.id,
      event: data.event || 'chunk',
      data: chunk.data,
  });
  }
}

type CompletionPayload = z.infer<typeof completionSchema>;

export const chatCompletion = async(userId: string, projectId: string, payload: CompletionPayload) => {
  const { conversationId, modelId, userPrompt } = payload;

  const shouldGenerateTitle = conversationId === null;

  const model = await repo.getModelById(modelId);
  if(!model){
    throw new BadRequest('Model not found')
  }

  let result: { conversation: Conversation, run: ConversationAgentRun } | null = null;
  if(conversationId){
    await assertConversationOwner(userId, conversationId)
    const conversation = await repo.getConversationById(conversationId);
    const run = await repo.createConversationRun({ projectId, conversationId, userMsg: {...userPrompt, id: uuidv4()} });
    result = {conversation, run}
  }else{
    const { conversation, agentRun } = await repo.createConversationComponents({ projectId, userId, userMsg: {...userPrompt, id: uuidv4()} });
    result = {conversation, run: agentRun}
  }

  if(!result){
    throw new BadRequest('Failed to create conversation or run')
  }

  await markStreamActive(result.run.id);

  // Fire and forget the agent run
  runAgent({
    userId,
    conversationId: result.conversation.id,
    projectId,
    model,
    runId: result.run.id,
    userPrompt,
    shouldGenerateTitle,
  })

  return result;

}

type RunAgentPayload = {
  userId: string;
  conversationId: string;
  projectId: string;
  model: LlmModel;
  runId: string;
  userPrompt: UserModelMessage;
  shouldGenerateTitle: boolean;
}

async function runAgent(payload: RunAgentPayload){
  const { userId, conversationId, projectId, model, runId, userPrompt, shouldGenerateTitle } = payload;
  const { controller, cleanup } = await createCancellableController(runId);
  
  try {
    await repo.updateConversationAgentRun(runId, { status: 'running' })

    const [project, checkpoint] = await Promise.all([
      getProjectById(projectId),
      repo.getCheckpoint(projectId, conversationId),
    ])
    
    // const checkpoint = await repo.getCheckpoint(project.id, conversationId);
    const session = new Session({
        sessionId: uuidv4(),
        userId,
        organizationId: project.organizationId,
        projectId: project.id,
        conversationId: conversationId,
        runId: runId,
    })
    const checkpointPersistence = new CheckpointPersistence(checkpoint, runId);

    const agentDefinition = getAgentDefinition('main-agent');
    if(!agentDefinition){
      throw new Error('Agent definition not found');
    }
    const agent = new Agent({
        name: agentDefinition.name,
        systemPrompt: agentDefinition.baseSystemPrompt,
        session,
        model,
        modelConfig: agentDefinition.modelConfig,
        persistence: checkpointPersistence,
    })

    const chunks = agent.runLoop(
        userPrompt,
        controller.signal,
        250,
    )

    for await (const chunk of chunks) {
      await writeStreamData(runId, {runId, event:'chunk', chunk});
    }

    if(shouldGenerateTitle){
      const conversationTitle = await handleTitleGeneration(userPrompt, project.organizationId)
      await repo.updateConversation(conversationId, { title: conversationTitle });
      // Maybe write the title to the stream
    }

    await repo.updateConversationAgentRun(runId, { status: 'finished' });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Completion failed';
    console.error(error);
    await repo.updateConversationAgentRun(runId, { status: 'error', error: errorMessage });
  } finally {
    await writeStreamData(runId, {runId, event: 'done'});
    await removeStreamActive(runId);
    await cleanup();
  }
}

async function handleTitleGeneration(userPrompt: UserModelMessage, organizationId: string){
  const content = userPrompt.content;
  const textPrompt = Array.isArray(content) ? content.find(p => p.type === 'text')?.text ?? '' : content;
  const {title} = await generateTitle({
    message: textPrompt,
    modelId: 'openai/gpt-5-nano',
    organizationId,
    abortSignal: new AbortController().signal, // This won't be aborted since the request will be done at this stage
  })
  return title
}





