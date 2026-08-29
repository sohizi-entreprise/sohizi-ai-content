import { CursorPaginationOptions } from '@/type';
import * as repo from './repo'
import { z } from 'zod';
import { UserModelMessage, userModelMessageSchema } from 'ai';
import { assertConversationOwner } from '@/lib/authorize';
import { Conversation, ConversationAgentRun } from '@/db/schema';
import { getModelWithVendorBinding, type ResolvedVendorModel } from '@/features/models/repo';
import { BadRequest } from '../error';
import { Session } from '../ai/agent/core/session';
import { v4 as uuidv4 } from 'uuid';
import { CheckpointPersistence } from '../ai/agent/core/persistence';
import { createAgentFromDefinition } from '../ai/agent/core/agent-factory';
import { getAgentDefinition } from '../ai/agent/core/agent-registry';
import { generateTitle } from '../ai/agent/utils/generate-title';
import { broadcastCancellation, createCancellableController } from '../generation-request/abort-manager';
import { markStreamActive, removeStreamActive, streamChunksAsSse, writeStreamData } from '../generation-request/stream-handler';
import { getProjectById } from '../project/repo';
import { getErrorMessage } from '@/utils/get-error-message';
import { listSkills } from '../file-system/repo';
import * as commandService from '../command/service';
import { buildInvokedCommandsPrompt, extractCommandNames } from '../command/resolve'
import { buildEditorContextPrompt, editorContextSchema, type EditorContext } from './editor-context';
import { extractTextFromUserMessage } from '../ai/agent/utils/message-content';

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

export { listLlmModels, listModelParameters } from '../models/service'

export const listConversationAgentRuns = async (conversationId: string, options?: CursorPaginationOptions) => {
  const agentRuns = await repo.listConversationAgentRuns(conversationId, options);
  return agentRuns;
}

export const completionSchema = z.object({
  conversationId: z.uuid('Invalid conversation id').nullable(),
  modelId: z.string('Invalid model id'),
  userPrompt: userModelMessageSchema,
  editorContext: editorContextSchema.optional(),
})

export const cancelRun = async (runId: string) => {
  try {
    await broadcastCancellation(runId);
    await repo.updateConversationAgentRun(runId, { status: 'finished' });
    await removeStreamActive(runId);
    return {ok: true, error: null};
    
  } catch (error) {
    console.error(error);
    return {ok: false, error: getErrorMessage(error, 'Failed to cancel run')};
  }
}

export async function* getStreams(runId: string) {
  yield* streamChunksAsSse(runId);
}

type CompletionPayload = z.infer<typeof completionSchema>;

export const chatCompletion = async(userId: string, projectId: string, payload: CompletionPayload) => {
  const { conversationId, modelId, userPrompt, editorContext } = payload;

  const shouldGenerateTitle = conversationId === null;

  const agentDefinition = getAgentDefinition('main-agent');
  if(!agentDefinition){
    throw new Error('Agent definition not found');
  }
  const model = await getModelWithVendorBinding(modelId, agentDefinition.vendor);
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
    editorContext,
    shouldGenerateTitle,
  })

  return result;

}

type RunAgentPayload = {
  userId: string;
  conversationId: string;
  projectId: string;
  model: ResolvedVendorModel;
  runId: string;
  userPrompt: UserModelMessage;
  editorContext?: EditorContext;
  shouldGenerateTitle: boolean;
}

async function runAgent(payload: RunAgentPayload){
  const { userId, conversationId, projectId, model, runId, userPrompt, editorContext, shouldGenerateTitle } = payload;
  const { controller, cleanup } = await createCancellableController(runId);
  
  try {
    await repo.updateConversationAgentRun(runId, { status: 'running' })

    const [project, checkpoint, projectSkills, userPromptText] = await Promise.all([
      getProjectById(projectId),
      repo.getCheckpoint(projectId, conversationId),
      listSkills(projectId),
      Promise.resolve(extractTextFromUserMessage(userPrompt)),
    ])
    
    const invokedCommandNames = extractCommandNames(userPromptText)
    const invokedCommands = invokedCommandNames.length > 0
      ? await commandService.resolveCommandsByNames(projectId, invokedCommandNames)
      : []
    
    const session = new Session({
        sessionId: uuidv4(),
        userId,
        organizationId: project.organizationId,
        projectId: project.id,
        conversationId: conversationId,
        runId: runId,
    })
    const checkpointPersistence = new CheckpointPersistence(checkpoint, runId);
    const agent = await createAgentFromDefinition({
        agentName: 'main-agent',
        session,
        model,
        persistence: checkpointPersistence,
        buildSystemPrompt: (baseSystemPrompt, definition) => enrichSystemPrompt(
          baseSystemPrompt,
          projectSkills,
          definition.subAgents,
          invokedCommands,
          editorContext,
        ),
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
    const errorMessage = getErrorMessage(error, 'Completion failed');
    console.error(error);
    await repo.updateConversationAgentRun(runId, { status: 'error', error: errorMessage });
  } finally {
    await writeStreamData(runId, {runId, event: 'done'});
    await removeStreamActive(runId);
    await cleanup();
  }
}

async function handleTitleGeneration(userPrompt: UserModelMessage, organizationId: string){
  const {title} = await generateTitle({
    message: extractTextFromUserMessage(userPrompt),
    modelId: 'openai/gpt-5-nano',
    organizationId,
    abortSignal: new AbortController().signal, // This won't be aborted since the request will be done at this stage
  })
  return title
}

function enrichSystemPrompt(
  systemPrompt: string,
  projectSkills: {name: string, description: string, instructions: string}[],
  subAgents: string[],
  invokedCommands: Array<{ name: string; action: string }> = [],
  editorContext?: EditorContext,
){
  let finalPrompt = systemPrompt;
  const skillPrompts = projectSkills
                        .filter(skill => !!skill.description.trim() && !!skill.instructions.trim())
                        .map((skill, index) => `${index + 1}. ${skill.name}:\n${skill.description}\n---\n`).join('\n');
  const subAgentDefinitions = subAgents.map(name => getAgentDefinition(name as any));
  const subAgentPrompts = subAgentDefinitions
                        .filter(subAgent => !!subAgent)
                        .map((subAgent, index) => `${index + 1}. ${subAgent.name}:\n${subAgent.description}\n---\n`).join('\n');
  if(skillPrompts.length > 0){
    finalPrompt += `
<project-skills>
Here are the skills that you have access to within this project. A skill is a package of instructions, metadata and resources that can give you
specialized capabilities and domain expertise to better perform your tasks. You can load skills "on-demand" depending on the task.

Project Skills (Name + Description):
${skillPrompts}

</project-skills>
`;
  }
  if(subAgentPrompts.length > 0){
    finalPrompt += `
<sub-agents>
Here are the sub-agents that you have access to within this project. A sub-agent is a specialized agent that can perform a specific isolated task.

Sub-Agents (Name + Description):
${subAgentPrompts}
</sub-agents>
`;
  }

  const invokedCommandsPrompt = buildInvokedCommandsPrompt(invokedCommands)
  if (invokedCommandsPrompt.length > 0) {
    finalPrompt += `\n\n${invokedCommandsPrompt}`
  }

  const editorContextPrompt = buildEditorContextPrompt(editorContext)
  if (editorContextPrompt.length > 0) {
    finalPrompt += `\n\n${editorContextPrompt}`
  }

  return finalPrompt.trim();
}





