import { AgentState, CursorPaginationOptions } from '@/type';
import * as repo from './repo'
import { CompletionRequest } from './payload';
import { BadRequest, InternalServerError } from '../error';
import { Agent } from '../ai/agent/core/agent';
import { Session, SessionInitData } from '../ai/agent/core/session';
import { E5SmallLocalEmbedder } from '@/lib/rag/local-embedder';
import { v4 as uuidv4 } from 'uuid';
import { generateTitle } from '../ai/agent/utils/generate-title';

export const listConversations = async (projectId: string, options?: CursorPaginationOptions) => {
  const conversations = await repo.listConversations(projectId, options);
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

export const listModelsForLeadAgent = async () => {
  const models = await repo.listModelsForLeadAgent();
  return models;
}

export const handleChatCompletion = async(projectId: string, request: CompletionRequest) => {
    return handleChatRun(projectId, request)
}

async function* handleChatRun(projectId: string, request: CompletionRequest) {
    const { modelId, userPrompt, conversationId, editorContext } = request;
    // If it's a new conversation, generate a title based on the user prompt
    // N.B. We need to register the cost of everything
    const model = await repo.getModelById(modelId);
    if (!model) {
        throw new BadRequest('Model not found');
    }
    if (!model.recommendedUsage?.includes('lead-agent')) {
        throw new BadRequest('Model not supported for lead agent');
    }
    let sessionInitData: Omit<SessionInitData, 'embedder'>;
    const sessionId = uuidv4();
    let conversationTitle = derivedTitle(userPrompt);

    if(conversationId === null) {
        const {success, title, usage} = await handleChatTitleGeneration(userPrompt);
        if(success) {
            conversationTitle = title;
        }
        const {conversation, checkpoint} = await repo.createConversationWithCheckpoint(projectId, conversationTitle);
        if(!conversation || !checkpoint) {
            throw new InternalServerError('Failed to create conversation or checkpoint');
        }

        sessionInitData = {
            sessionId,
            model,
            projectId,
            conversationId: conversation.id,
            checkpoint
        }
    }else{
        const conversation = await repo.getConversationById(conversationId);
        if (!conversation) {
            throw new BadRequest('Conversation not found');
        }
        const checkpoint = await repo.getCheckpoint(projectId, conversationId);
        if (!checkpoint) {
            throw new BadRequest('Checkpoint not found');
        }
        conversationTitle = conversation.title;
        sessionInitData = {
            sessionId,
            model,
            projectId,
            conversationId: conversation.id,
            checkpoint
        }
    }

    yield {type: "identifier", conversationId: sessionInitData.conversationId, conversationTitle}

    const embedder = new E5SmallLocalEmbedder()

    const session = new Session({...sessionInitData, embedder})

    const agent = new Agent(
        'main-agent', 
        `You are a helpful assistant that can help with tasks. Before calling any tool, you MUST write exactly one short progress sentence to the user. Only after that sentence, call the tool.`,
        session
    )
    yield* agent.runLoop(
        userPrompt, 
        new AbortController().signal, 
        25,
    )
}

async function handleChatTitleGeneration(firstMsg: string) {
    try {
        const {title, usage} = await generateTitle(firstMsg, new AbortController().signal);
        return {success: true as const, title, usage};
    } catch (error) {
        console.error(error);
        return {success: false as const, error: error instanceof Error ? error.message : String(error), usage: null};
    }
}

function derivedTitle(firstMsg: string) {
    const title = firstMsg
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 15)
        .toLowerCase();

    return title.charAt(0).toUpperCase() + title.slice(1);
}



