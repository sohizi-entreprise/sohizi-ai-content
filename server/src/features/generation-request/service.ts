import { getModelById } from "../chat/repo";
import { BadRequest, NotFound } from "../error";
import { ChatCompletionRequest, MediaGenerationRequest } from "./schema";
import { broadcastCancellation } from "./abort-manager";
import { getProjectById } from "../project/repo";
import { getConversationById } from "@/entities/chat/repo";
import { inngest } from "@/lib/inngest";
import { BaseContextEventData } from "./inngest";
import { getGenerationRequestById, updateGenerationRequest, createGenerationRequest, getGenerationRequestsByIds, getPendingRequests } from "./repo";
import { completeRequest } from "./stream-handler";


export async function handleChatCompletionRequest(request: ChatCompletionRequest, userId: string, projectId: string) {
    const { modelId, conversationId } = request;

    const project = await getProjectById(projectId);
    if (!project) {
        throw new BadRequest('Project not found');
    }
    const model = await getModelById(modelId);
    if (!model) {
        throw new BadRequest('Model not found');
    }

    if(conversationId){
        const conversation = await getConversationById(conversationId);
        if(!conversation){
            throw new BadRequest('Conversation not found');
        }
    }

    const genRequest = await createGenerationRequest({
        projectId,
        userId,
        type: request.type,
        request
    });

    const context: BaseContextEventData = {
        requestId: genRequest.id,
        projectId,
        organizationId: project.organizationId,
        userId,
    }

    await inngest.send({
        name: 'stream/chat.completion',
        data: {
            request,
            context,
        },
    });

    return { requestId: genRequest.id, requestType: request.type };
}


export async function handleMediaGenerationRequest(request: MediaGenerationRequest, userId: string, projectId: string) {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new BadRequest('Project not found');
    }

    const genRequest = await createGenerationRequest({
        projectId,
        userId,
        type: request.type,
        request,
    });

    const context: BaseContextEventData = {
        requestId: genRequest.id,
        projectId,
        organizationId: project.organizationId,
        userId,
    }

    await inngest.send({
        name: 'stream/media.generation',
        data: {
            request,
            context,
        },
    });

    return { requestId: genRequest.id, requestType: request.type };
}


export const cancelRequest = async (projectId: string, userId: string, requestId: string) => {
    const genRequest = await getGenerationRequestById(projectId, requestId);
    if(!genRequest){
        throw new BadRequest('Generation request not found');
    }

    await broadcastCancellation(requestId);

    await updateGenerationRequest(requestId, { status: 'aborted' });

    await completeRequest(userId, requestId);

    return {}
}

export async function listPendingRequests(projectId: string, userId: string) {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    return getPendingRequests(projectId, userId);
}

export async function getRequestStatuses(projectId: string, data: {requestIds: string[];}) {
    const project = await getProjectById(projectId);
    if (!project) {
        throw new NotFound('Project not found');
    }
    return getGenerationRequestsByIds(projectId, data.requestIds);
}
