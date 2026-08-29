import { NonRetriableError } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import * as repo from './repo';
import * as storage from './storage';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from '@/db/schema';
import { billingService, safeRefund } from '@/features/billing';
import { isMediaError } from './errors';
import { finalizeGenerationRequest, writeStreamData } from '../generation-request/stream-handler';
import { appendRequestAssets } from '../generation-request/repo';
import type { GenerationRequestAsset } from '@/type';
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
import { createAgentFromDefinition } from '../ai/agent/core/agent-factory';
import { UserModelMessage } from 'ai';
import { getErrorMessage } from '@/utils/get-error-message';
import { getModelSchema } from './repo';
import {
    limiter,
    pollWithSticky,
    resolveAndAcquire,
    submitWithFailover,
    type StickyDecision,
} from '@/features/routing';
import { MediaRateLimitError, MediaServiceUnavailableError } from './errors';
import { SubmitRequestInput } from '../ai/agent/tools/submit-media-jobs';
import { MAX_MEDIA_POLL_ATTEMPTS, VIDEO_POLL_INTERVAL } from './constants';

const MEDIA_POLL_INTERVAL = '5s';
const SYNC_RESERVATION_TTL_MS = 30 * 60 * 1000;
const VIDEO_RESERVATION_TTL_MS = 60 * 60 * 1000;

type ProviderMediaType = 'image' | 'video' | 'audio';

type ReferenceFile = {url: string, type: 'image' | 'video' | 'audio'};

type ProviderMediaEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    model: string;
    payload: SubmitPayload;
    referenceFiles: ReferenceFile[];
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

    const message = getErrorMessage(error);
    const cause = error instanceof Error ? error : undefined;

    throw new NonRetriableError(message, { cause });
}

function toRequestAsset(asset: Asset): GenerationRequestAsset | null {
    if (asset.type === 'image' || asset.type === 'video' || asset.type === 'audio' || asset.type === 'html') {
        return { assetId: asset.id, type: asset.type, url: asset.url, name: asset.name };
    }
    return null;
}

// ─── Provider Media Generation ───────────────────────────────────────

export const handleMediaGeneration = inngest.createFunction(
    {
        id: 'media-generate',
        retries: 0,
        triggers: [{ event: 'media/generate' }],
        onFailure: async ({ event }) => {
            const data = event.data.event.data as ProviderMediaEventData;
            await safeRefund(billingService, data._reservationId, 'media-generation-failed');
            if (data.requestId) {
                await limiter.releaseByRequestId(data.requestId, { outcome: 'none' });
                await finalizeGenerationRequest(data.requestId, 'failed');
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
                    referenceFiles: data.referenceFiles,
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

        const decision = await step.run('resolve-route', async () => {
            try {
                const {modelId, ...payload} = requestPayload;
                return await resolveAndAcquire({
                    modelId: modelId as string || model,
                    requestId,
                    payload,
                    leaseTtlMs: reservationTtlMs,
                });
            } catch (error) {
                wrapNonRetryable(error);
            }
        });

        let sticky: StickyDecision | undefined;
        try {
        const reservation = await step.run('reserve-credits', async () => {
            try {
                const provider = createProvider(decision.vendorName);
                const estimate = await provider.estimateRequestPrice(decision.apiName, decision.mappedPayload);
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
                    idempotencyKey: `media:${requestId}:${model}:${decision.vendorName}`,
                    metadata: { requestId, projectId, kind: mediaType, model, vendor: decision.vendorName },
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

        try {
            sticky = await step.run('submit-job', async () => {
                    try {
                        const provider = createProvider(decision.vendorName);
                        const submitted = await provider.submitRequest(decision.apiName, decision.mappedPayload);
                        await limiter.release(decision.vendorName, requestId, {
                            outcome: 'submit_ok',
                            cooldownMs: decision.cooldownMs,
                        });
                        const result: StickyDecision = {
                            ...decision,
                            providerRequestId: submitted.requestId,
                        };
                        await repo.patchRequestRouting(requestId, {
                            vendorName: result.vendorName,
                            apiName: result.apiName,
                            providerRequestId: result.providerRequestId,
                        });
                        return result;
                    } catch (error) {
                        if (error instanceof MediaRateLimitError || error instanceof MediaServiceUnavailableError) {
                            await limiter.release(decision.vendorName, requestId, {
                                outcome: 'failure',
                                retryAfterMs: error instanceof MediaRateLimitError ? error.retryAfterMs : undefined,
                                cooldownMs: decision.cooldownMs,
                            });
                            const result = await submitWithFailover({
                                modelId: model,
                                requestId,
                                payload: requestPayload,
                                leaseTtlMs: reservationTtlMs,
                                exclude: [decision.vendorName],
                            });
                            await repo.patchRequestRouting(requestId, {
                                vendorName: result.vendorName,
                                apiName: result.apiName,
                                providerRequestId: result.providerRequestId,
                            });
                            return result;
                        }
                        await limiter.release(decision.vendorName, requestId, {
                            outcome: 'none',
                            cooldownMs: decision.cooldownMs,
                        });
                        wrapNonRetryable(error);
                    }
                });
            } catch (error) {
                await step.run('refund-on-submit-error', () => safeRefund(billingService, reservation.id, 'media-submit-error'));
                throw error;
            }

            let resultData: unknown = null;

            for (let attempt = 0; attempt < MAX_MEDIA_POLL_ATTEMPTS; attempt++) {
                await step.sleep(`wait-for-media-${attempt}`, pollInterval);

                await step.run(`renew-reservation-${attempt}`, async () => {
                    await billingService.renewIfNearExpiry(reservation.id, reservationTtlMs);
                });

                const pollResult = await step.run(`poll-media-${attempt}`, async () => {
                    try {
                        return await pollWithSticky(sticky!);
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
                        safeRefund(billingService, reservation.id, 'media-provider-failed'),
                    );
                    await step.run('mark-error-on-provider-failure', () => finalizeGenerationRequest(requestId, 'failed'));
                    return { requestId, status: 'failed' as const };
                }
            }

            const outputUrls = extractOutputUrls(resultData);
            if (outputUrls.length === 0) {
                await step.run('refund-on-timeout-or-empty', () =>
                    safeRefund(billingService, reservation.id, resultData ? 'media-no-valid-urls' : 'media-poll-timeout'),
                );
                await step.run('mark-error-on-timeout-or-empty', () => finalizeGenerationRequest(requestId, 'failed'));
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
                    metadata: { requestId, providerCostUsd: reservation.priceUSD, vendor: sticky?.vendorName },
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

                await finalizeGenerationRequest(requestId, 'completed');
                return newAssets;
            });

            return { requestId, assets, reservationId: reservation.id };
        } finally {
            await step.run('release-slot', async () => {
                if (sticky) {
                    await limiter.release(sticky.vendorName, requestId, { outcome: 'none' });
                    return;
                }
                await limiter.releaseByRequestId(requestId, { outcome: 'none' });
            });
        }
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
    referenceFiles: ReferenceFile[];
}

type AgentResponse = {
    ok: true;
    request: Record<string, unknown>;
} | {
    ok: false;
    error: string;
}


async function runAgent(payload: AgentPayload){
    const { userId, projectId, requestId, organizationId, requestPayload, requestModelId, referenceFiles } = payload;
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
      const agent = await createAgentFromDefinition({
          agentName: 'media-generator',
          session,
          persistence,
          buildSystemPrompt: (baseSystemPrompt) => fullPrompt(baseSystemPrompt, referenceFiles),
      })
  
      const chunks = agent.runLoop(
          buildUserPrompt(requestPayload.prompt as string, referenceFiles),
          controller.signal,
          250,
      )

      for await (const chunk of chunks) {
        await writeStreamData(requestId, {runId: requestId, event:'chunk', chunk});
      }

      const submitRequest = agent.artifacts.get('submitRequest') as {status: 'ready' | 'cancelled', input: SubmitRequestInput} | undefined;
      if(submitRequest?.status === 'ready'){
        response = {
            ok: true,
            request: { ...submitRequest.input.parameters, prompt: submitRequest.input.prompt, modelId: submitRequest.input.modelId },
        };
      }else{
        response = {
            ok: false,
            error: 'Request cancelled',
        };
      }

    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Completion failed');
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



function buildUserPrompt(prompt: string, referenceFiles: ReferenceFile[]=[]): UserModelMessage {

    const userMsg : UserModelMessage = {
        role: 'user',
        content: [
            { type: 'text', text: prompt },
            ...referenceFiles.map(file => ({ type: 'image' as const, image: file.url })),
        ],
    };

    return userMsg;
}

function fullPrompt(basePrompt: string, referenceFiles: ReferenceFile[]){
    return `
${basePrompt}

${
    referenceFiles.length > 0 ? `
<reference_files>
Here are the files referenced by the user:
${JSON.stringify(referenceFiles)}
</reference_files>
` : ''
    }
`.trim();
}