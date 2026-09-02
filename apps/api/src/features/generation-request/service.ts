import { sse } from 'elysia'
import { getConversationById } from '../chat/repo'
import { getModelById } from '../models/repo'
import { BadRequest, NotFound } from '../error'
import { ChatCompletionRequest } from './schema'
import { broadcastCancellation } from './abort-manager'
import { getProjectById } from '../project/repo'
import { inngest } from '@/lib/inngest/client'
import {
  getGenerationRequestById,
  updateGenerationRequest,
  createGenerationRequest,
  getGenerationRequestsByIds,
  getPendingRequests,
} from './repo'

type BaseContextEventData = {
  requestId: string
  projectId: string
  organizationId: string
  userId: string
}

export async function handleChatCompletionRequest(
  request: ChatCompletionRequest,
  userId: string,
  projectId: string,
) {
  const { modelId, conversationId } = request

  const project = await getProjectById(projectId)
  if (!project) {
    throw new BadRequest('Project not found')
  }
  const model = await getModelById(modelId)
  if (!model) {
    throw new BadRequest('Model not found')
  }

  if (conversationId) {
    const conversation = await getConversationById(conversationId)
    if (!conversation) {
      throw new BadRequest('Conversation not found')
    }
  }

  const genRequest = await createGenerationRequest({
    projectId,
    userId,
    type: request.type,
    request,
  })

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
  })

  return { requestId: genRequest.id, requestType: request.type }
}

export const cancelRequest = async (
  projectId: string,
  userId: string,
  requestId: string,
) => {
  const genRequest = await getGenerationRequestById(projectId, requestId)
  if (!genRequest) {
    throw new BadRequest('Generation request not found')
  }

  await broadcastCancellation(requestId)

  await updateGenerationRequest(requestId, { status: 'aborted' })

  return {}
}

export async function listPendingRequests(projectId: string, userId: string) {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new NotFound('Project not found')
  }
  return getPendingRequests(projectId, userId)
}

export async function getRequestStatuses(
  projectId: string,
  data: { requestIds: string[] },
) {
  const project = await getProjectById(projectId)
  if (!project) {
    throw new NotFound('Project not found')
  }
  return getGenerationRequestsByIds(projectId, data.requestIds)
}

export async function* streamActiveRequestsSSE(
  _userId: string,
  _lastEventIds?: Record<string, string>,
) {
  yield sse({ event: 'ready', data: '' })
}
