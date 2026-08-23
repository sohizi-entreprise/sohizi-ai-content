import { NonRetriableError } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import * as repo from './repo';
import * as storage from './storage';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from '@/db/schema';
import { billingService } from '@/features/billing';
import { isMediaError } from './errors';
import { decrementKey, removeStreamActive, writeStreamData } from '../generation-request/stream-handler';
import { appendRequestAssets } from '../generation-request/repo';
import type { GenerationRequestAsset } from '@/type';
import { WAVE_SPEED_VENDOR } from '@/features/ai/agent/core/vendor';
import { createProvider } from './providers/factory';
import { extractOutputUrls } from './providers/utils';
import type { SubmitPayload } from './providers/type';
import {
    AUDIO_OVERHEAD_RATE,
    IMAGE_OVERHEAD_RATE,
    VIDEO_OVERHEAD_RATE,
} from '@/features/billing/constants';
import {
    providerCostToActualCredits,
    providerCostToCredits,
} from './generators/cost-utils';
import { createCancellableController } from '../generation-request/abort-manager';
import { Session } from '../ai/agent/core/session';
import { MediaGenerationPersistence } from '../ai/agent/core/persistence';
import { getAgentDefinition } from '../ai/agent/core/agent-registry';
import { getModelWithVendorBinding } from '../models/repo';
import { Agent } from '../ai/agent/core/agent';
import { UserModelMessage } from 'ai';
import { getModelSchema } from './repo';

const MAX_MEDIA_POLL_ATTEMPTS = 60;
const VIDEO_POLL_INTERVAL = '10s';
const MEDIA_POLL_INTERVAL = '5s';
const SYNC_RESERVATION_TTL_MS = 30 * 60 * 1000;
const VIDEO_RESERVATION_TTL_MS = 60 * 60 * 1000;

type ProviderMediaType = 'image' | 'video' | 'audio';

type ProviderMediaEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    model: string;
    payload: SubmitPayload;
    mediaType: ProviderMediaType;
    runMode: 'agent' | 'direct';
    _reservationId: string;
};

function mediaOverheadRate(mediaType: ProviderMediaType): number {
    if (mediaType === 'video') return VIDEO_OVERHEAD_RATE;
    if (mediaType === 'audio') return AUDIO_OVERHEAD_RATE;
    return IMAGE_OVERHEAD_RATE;
}

function mediaReservationTtlMs(mediaType: ProviderMediaType): number {
    return mediaType === 'video' ? VIDEO_RESERVATION_TTL_MS : SYNC_RESERVATION_TTL_MS;
}

function mediaPollInterval(mediaType: ProviderMediaType) {
    return mediaType === 'video' ? VIDEO_POLL_INTERVAL : MEDIA_POLL_INTERVAL;
}

function isTerminalFailureStatus(status: string): boolean {
    return status === 'error' || status === 'failed' || status === 'cancelled' || status === 'timeout';
}

function shouldRetry(error: unknown): boolean {
    if (isMediaError(error)) {
        return error.isRetriable;
    }
    return false;
}

function wrapNonRetryable(error: unknown): never {
    if (shouldRetry(error)) {
        throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    throw new NonRetriableError(message, { cause });
}

async function safeRefund(reservationId: string | undefined | null, reason: string): Promise<void> {
    if (!reservationId) return;
    try {
        await billingService.refund(reservationId, reason);
    } catch (err) {
        console.error('[billing] refund failed', reservationId, err);
    }
}

function toRequestAsset(asset: Asset): GenerationRequestAsset | null {
    if (asset.type === 'image' || asset.type === 'video' || asset.type === 'audio' || asset.type === 'html') {
        return { assetId: asset.id, type: asset.type, url: asset.url, name: asset.name };
    }
    return null;
}

async function commitRequest(requestId: string, status: 'completed' | 'failed') {
    const res = await decrementKey(requestId);
    if (res === 0) {
        await repo.updateAssetRequest(requestId, { status });
        await removeStreamActive(requestId);
    }
}

// ─── Provider Media Generation ───────────────────────────────────────

export const handleMediaGeneration = inngest.createFunction(
    {
        id: 'media-generate',
        retries: 0,
        triggers: [{ event: 'media/generate' }],
        onFailure: async ({ event }) => {
            const data = event.data.event.data as ProviderMediaEventData;
            await safeRefund(data._reservationId, 'media-generation-failed');
            if (data.requestId) {
                await commitRequest(data.requestId, 'failed');
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as ProviderMediaEventData;
        const { requestId, projectId, organizationId, userId, model, payload, mediaType } = data;
        const overheadRate = mediaOverheadRate(mediaType);
        const reservationTtlMs = mediaReservationTtlMs(mediaType);
        const pollInterval = mediaPollInterval(mediaType);

        const requestPayload = await step.run('run-agent', async () => {
            if(data.runMode === 'agent'){
                const output = await runAgent({
                    userId,
                    projectId,
                    requestId,
                    organizationId,
                    requestPayload: payload,
                    requestModelId: model,
                });
                if(output.ok){
                    return output.request as SubmitPayload;
                }else{
                    console.error(output.error);
                    throw new Error(output.error);
                }
            }else{
                return payload;
            }
        });

        const reservation = await step.run('reserve-credits', async () => {
            try {
                const provider = createProvider(WAVE_SPEED_VENDOR);
                const estimate = await provider.estimateRequestPrice(model, requestPayload);
                if (!estimate.ok) {
                    throw new Error(estimate.error);
                }
                const estimatedCredits = providerCostToCredits(estimate.priceUSD, { overheadRate });
                const res = await billingService.reserve({
                    organizationId,
                    userId,
                    operation: `media:${mediaType}`,
                    estimatedCredits,
                    ttlMs: reservationTtlMs,
                    id: data._reservationId,
                    idempotencyKey: `media:${requestId}:${model}`,
                    metadata: { requestId, projectId, kind: mediaType, model },
                });
                return {
                    id: res.id,
                    estimatedCredits: estimatedCredits.toString(),
                    priceUSD: estimate.priceUSD,
                };
            } catch (error) {
                wrapNonRetryable(error);
            }
        });

        let submission;
        try {
            submission = await step.run('submit-job', async () => {
                try {
                    const provider = createProvider(WAVE_SPEED_VENDOR);
                    return await provider.submitRequest(model, requestPayload);
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });
        } catch (error) {
            await step.run('refund-on-submit-error', () => safeRefund(reservation.id, 'media-submit-error'));
            throw error;
        }

        let resultData: unknown = null;

        for (let attempt = 0; attempt < MAX_MEDIA_POLL_ATTEMPTS; attempt++) {
            await step.sleep(`wait-for-media-${attempt}`, pollInterval);

            await step.run(`renew-reservation-${attempt}`, async () => {
                const current = await billingService.getReservation(reservation.id);
                if (!current || current.status !== 'reserved') return;
                const remainingMs = current.expiresAt.getTime() - Date.now();
                if (remainingMs > reservationTtlMs * 0.2) return;
                await billingService.extend(reservation.id, reservationTtlMs);
            });

            const pollResult = await step.run(`poll-media-${attempt}`, async () => {
                try {
                    const provider = createProvider(WAVE_SPEED_VENDOR);
                    return await provider.getRequestData(submission.requestId);
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });

            if (pollResult.status === 'completed') {
                resultData = 'data' in pollResult ? pollResult.data : null;
                break;
            }

            if (isTerminalFailureStatus(String(pollResult.status))) {
                await step.run('refund-on-provider-failure', () =>
                    safeRefund(reservation.id, 'media-provider-failed'),
                );
                await step.run('mark-error-on-provider-failure', () => commitRequest(requestId, 'failed'));
                return { requestId, status: 'failed' as const };
            }
        }

        const outputUrls = extractOutputUrls(resultData);
        if (outputUrls.length === 0) {
            await step.run('refund-on-timeout-or-empty', () =>
                safeRefund(reservation.id, resultData ? 'media-no-valid-urls' : 'media-poll-timeout'),
            );
            await step.run('mark-error-on-timeout-or-empty', () => commitRequest(requestId, 'failed'));
            return { requestId, status: 'failed' as const };
        }

        const uploads = await step.run('upload-to-r2', async () => {
            const uploaded = [];
            for (const sourceUrl of outputUrls) {
                uploaded.push(await storage.uploadGeneratedMedia(sourceUrl));
            }
            return uploaded;
        });

        await step.run('settle-credits', () =>
            billingService.settle({
                reservationId: reservation.id,
                actualCredits: providerCostToActualCredits(reservation.priceUSD, { overheadRate }),
                metadata: { requestId, providerCostUsd: reservation.priceUSD },
            }),
        );

        const assets = await step.run('save-assets', async () => {
            const newAssets: Asset[] = [];
            for (const upload of uploads) {
                const fileMetadata = await storage.getFileMetadata(upload.storageKey);
                const assetName = upload.storageKey.split('/').pop() ?? `${upload.type}-${uuidv4().slice(0, 8)}`;
                const asset = await repo.createAsset({
                    projectId,
                    name: assetName,
                    type: upload.type,
                    url: upload.url,
                    source: 'ai-generated',
                    generationRequestId: requestId,
                    metadata: fileMetadata,
                    storageKey: upload.storageKey,
                });
                await writeStreamData(requestId, { runId: requestId, event: 'asset', data: asset });
                newAssets.push(asset);
            }

            const requestAssets = newAssets
                .map(toRequestAsset)
                .filter((asset): asset is GenerationRequestAsset => asset !== null);
            if (requestAssets.length > 0) {
                await appendRequestAssets(requestId, requestAssets);
            }

            await commitRequest(requestId, 'completed');
            return newAssets;
        });

        return { requestId, assets, reservationId: reservation.id };
    },
);


// This function is used when we are in agent mode
type AgentPayload = {
    userId: string;
    projectId: string;
    organizationId: string;
    requestId: string;
    requestPayload: SubmitPayload;
    requestModelId: string;
}

type AgentResponse = {
    ok: true;
    request: Record<string, unknown>;
} | {
    ok: false;
    error: string;
}


async function runAgent(payload: AgentPayload){
    const { userId, projectId, requestId, organizationId, requestPayload, requestModelId } = payload;
    const { controller, cleanup } = await createCancellableController(requestId);

    let response: AgentResponse = {
        ok: false,
        error: 'Unknown error occurred',
    };
    
    try {
      const session = new Session({
          sessionId: uuidv4(),
          userId,
          organizationId,
          projectId,
          runId: requestId,
      })
      const persistence = new MediaGenerationPersistence(requestId);
  
      const agentDefinition = getAgentDefinition('media-generator');
      if(!agentDefinition){
        throw new Error('Agent definition not found');
      }

      const [model, modelSchema] = await Promise.all([
        getModelWithVendorBinding(agentDefinition.modelId, agentDefinition.vendor),
        getModelSchema(requestModelId),
      ]);

      if(!model){
        throw new Error('Model not found');
      }
      const agent = new Agent({
          name: agentDefinition.name,
          systemPrompt: fullPrompt(agentDefinition.baseSystemPrompt, requestPayload, modelSchema),
          session,
          model,
          vendor: agentDefinition.vendor,
          modelConfig: agentDefinition.modelConfig,
          persistence: persistence,
          maxContextTokens: agentDefinition.maxContextTokens,
          contextThreshold: agentDefinition.contextThreshold,
          summaryModelId: agentDefinition.summaryModelId,
          evaluatorModelId: agentDefinition.evaluatorModelId,
          evaluatorModelConfig: agentDefinition.evaluatorModelConfig,
      })
  
      const chunks = agent.runLoop(
          buildUserPrompt(requestPayload),
          controller.signal,
          250,
      )

      let finalText = '';
  
      for await (const chunk of chunks) {
        if ((chunk.type === 'text_delta' || chunk.type === 'complete') && chunk.text) {
            finalText = chunk.text;
        }
        await writeStreamData(requestId, {runId: requestId, event:'chunk', chunk});
      }

      const jsonResult = parseAgentPayload(finalText);
      response = {
        ok: true,
        request: jsonResult,
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Completion failed';
      console.error(error);
      response = {
        ok: false,
        error: errorMessage,
      };
    } finally {
      await cleanup();
    }

    return response;
  }


function parseAgentPayload(text: string): Record<string, unknown> {
    const trimmed = text.trim();
    if (!trimmed) {
        throw new Error('Agent finished without a JSON payload');
    }

    const unfenced = trimmed
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    try {
        return JSON.parse(unfenced) as Record<string, unknown>;
    } catch {
        const start = unfenced.indexOf('{');
        const end = unfenced.lastIndexOf('}');
        if (start !== -1 && end > start) {
            return JSON.parse(unfenced.slice(start, end + 1)) as Record<string, unknown>;
        }
        throw new Error('Agent output was not valid JSON');
    }
}

function buildUserPrompt(payload: SubmitPayload): UserModelMessage {
    const prompt = payload.prompt as string;

    return { role: 'user', content: [{ type: 'text', text: prompt }] };
}

function fullPrompt(basePrompt: string, request: Record<string, unknown>, modelSchema: Record<string, unknown>[]){
    return `
${basePrompt}

<generation_request>
${JSON.stringify(request)}
</generation_request>

<parameter_schema>
${JSON.stringify(modelSchema)}
</parameter_schema>
`.trim();
}