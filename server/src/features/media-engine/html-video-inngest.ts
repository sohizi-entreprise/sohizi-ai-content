import { NonRetriableError } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { Agent } from '@/features/ai/agent/core/agent'
import { Session } from '@/features/ai/agent/core/session'
import { getAgentDefinition } from '@/features/ai/agent/core/agent-registry'
import { getModelById } from '@/features/chat/repo'
import type { LlmModel } from '@/db/schema'
import type { UserModelMessage } from 'ai'
import { v4 as uuidv4 } from 'uuid'
import * as repo from './repo'
import * as storage from './storage'
import { takeHtmlCompositionHandoff } from './html-composition'
import { decrementKey, removeStreamActive, writeStreamData } from '../generation-request/stream-handler'
import type { AssetMetadata, CompositionVariable } from '@/type'

type HtmlVideoEventData = {
    requestId: string
    projectId: string
    organizationId: string
    userId: string
    instructions: string
}

/** Metadata-only step output — HTML never enters Inngest state. */
type UploadedHtmlComposition = {
    storageKey: string
    url: string
    name: string
    duration: number
    width: number
    height: number
    variables: CompositionVariable[]
    values: Record<string, string | number | boolean>
    compositionId?: string
    size: number
}

async function commitRequest(requestId: string, status: 'finished' | 'error') {
    const res = await decrementKey(requestId)
    if (res === 0) {
        await repo.updateAssetRequest(requestId, { status })
        await removeStreamActive(requestId)
    }
}

export const handleHtmlVideoGeneration = inngest.createFunction(
    {
        id: 'media-generate-html-video',
        retries: 0,
        triggers: [{ event: 'media/generate.html-video' }],
        onFailure: async ({ event }) => {
            const data = event.data.event.data as HtmlVideoEventData
            if (data.requestId) {
                await commitRequest(data.requestId, 'error')
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as HtmlVideoEventData
        const { requestId, projectId, organizationId, userId, instructions } = data

        const resolvedModel = await step.run('resolve-model', async () => {
            const agentDefinition = getAgentDefinition('motion-graphic')
            if (!agentDefinition) {
                throw new NonRetriableError('motion-graphic agent definition not found')
            }
            const model = await getModelById(agentDefinition.modelId)
            if (!model) {
                throw new NonRetriableError(`Model not found: ${agentDefinition.modelId}`)
            }
            return { modelId: model.id }
        })

        // Generate + upload in one step so HTML never becomes Inngest step output.
        const uploaded = await step.run('generate-and-upload', async (): Promise<UploadedHtmlComposition> => {
            const agentDefinition = getAgentDefinition('motion-graphic')
            if (!agentDefinition) {
                throw new NonRetriableError('motion-graphic agent definition not found')
            }
            const model = await getModelById(resolvedModel.modelId)
            if (!model) {
                throw new NonRetriableError(`Model not found: ${resolvedModel.modelId}`)
            }

            const session = new Session({
                sessionId: uuidv4(),
                userId,
                organizationId,
                projectId,
                runId: requestId,
            })

            const agent = new Agent({
                name: agentDefinition.name,
                systemPrompt: agentDefinition.baseSystemPrompt,
                session,
                model: model as unknown as LlmModel,
                modelConfig: agentDefinition.modelConfig,
                maxContextTokens: agentDefinition.maxContextTokens,
                contextThreshold: agentDefinition.contextThreshold,
                summaryModelId: agentDefinition.summaryModelId,
            })

            const userPrompt: UserModelMessage = {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: instructions,
                    },
                ],
            }

            for await (const chunk of agent.runLoop(userPrompt, new AbortController().signal, 40)) {
                console.log('[html-video] agent chunk', {
                    requestId,
                    type: chunk.type,
                    name: chunk.name,
                    chunk,
                })
            }

            const handoff = takeHtmlCompositionHandoff(requestId)
            if (!handoff) {
                throw new NonRetriableError(
                    'Motion graphic agent ended without calling submitHtmlComposition',
                )
            }
            if (handoff.status === 'blocked') {
                throw new NonRetriableError(
                    handoff.message || 'Motion graphic agent blocked the request',
                )
            }

            const submitted = handoff.submission
            const safeName = submitted.name
                .replace(/[/\\\s]+/g, '-')
                .toLowerCase()
                .slice(0, 80)
            const fileName = safeName.endsWith('.html') ? safeName : `${safeName}.html`
            const destPath = storage.buildStoragePath('htmls', fileName)
            const buffer = Buffer.from(submitted.html, 'utf-8')
            const upload = await storage.uploadFromBuffer(buffer, destPath, 'text/html')

            return {
                storageKey: upload.storageKey,
                url: upload.url,
                name: submitted.name.endsWith('.html')
                    ? submitted.name
                    : `${submitted.name}.html`,
                duration: submitted.duration,
                width: submitted.width,
                height: submitted.height,
                variables: submitted.variables,
                values: submitted.values,
                compositionId: submitted.compositionId,
                size: upload.size,
            }
        })

        const asset = await step.run('save-asset', async () => {
            const metadata: AssetMetadata = {
                size: uploaded.size,
                contentType: 'text/html',
                duration: uploaded.duration,
                width: uploaded.width,
                height: uploaded.height,
                variables: uploaded.variables,
                values: uploaded.values,
                compositionId: uploaded.compositionId,
            }

            const asset = await repo.createAsset({
                projectId,
                name: uploaded.name,
                type: 'html',
                url: uploaded.url,
                source: 'ai-generated',
                generationRequestId: requestId,
                metadata,
                storageKey: uploaded.storageKey,
            })

            await writeStreamData(requestId, { runId: requestId, event: 'asset', data: asset })
            await commitRequest(requestId, 'finished')
            return asset
        })

        return { requestId, assetId: asset.id }
    },
)
