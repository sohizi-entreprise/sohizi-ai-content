import { NonRetriableError } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import * as repo from './repo';
import * as storage from './storage';
import { type ImageSizePreset } from '@/constants/media';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from '@/db/schema';
import { billingService } from '@/features/billing';
import {
    createBillableMultiModalClient,
    MultiModalClient,
    type BillableMultiModalInput,
    videoActualCredits,
} from '@/features/ai/agent/utils/multi-llm-client';
import { isMediaError } from './errors';
import { decrementKey, removeStreamActive, writeStreamData } from '../generation-request/stream-handler';

type ImageEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    prompt: string;
    model: string;
    aspectRatio: ImageSizePreset;
    referenceImages?: string[];
    numVariations: number;
};

type DialogueSpeaker = {
    name: string;
    voice: string;
};

type AudioEventPayload =
    | {
          type: 'text-to-speech';
          params: {
              text: string;
              voice?: string;
              instructions?: string;
              model?: string;
          };
      }
    | {
          type: 'dialogue';
          params: {
              script: string;
              speakers: DialogueSpeaker[];
              instructions?: string;
              model?: string;
          };
      }
    | {
          type: 'generate-music';
          params: {
              prompt: string;
              model?: string;
          };
      };

type AudioEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    payload: AudioEventPayload;
};

type VideoEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    prompt: string;
    model: string;
    duration: number;
    aspectRatio: '16:9' | '9:16' | '1:1';
    referenceImage?: string;
};

const MAX_VIDEO_POLL_ATTEMPTS = 60;
const VIDEO_POLL_INTERVAL = '10s';
const SYNC_RESERVATION_TTL_MS = 30 * 60 * 1000;
const VIDEO_RESERVATION_TTL_MS = 60 * 60 * 1000;

const multimodal = createBillableMultiModalClient({
    timeoutMs: 15 * 60 * 1000,
    ttlMs: VIDEO_RESERVATION_TTL_MS,
});
const videoClient = new MultiModalClient();

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

async function commitRequest(requestId: string, status: 'finished' | 'error') {
    const res = await decrementKey(requestId);
    if (res === 0) {
        await repo.updateAssetRequest(requestId, { status });
        await removeStreamActive(requestId);
    }
}

async function uploadImageSource(
    sourceUrl: string,
    destinationPath: string,
): Promise<{ url: string; storageKey: string; size: number }> {
    if (sourceUrl.startsWith('data:')) {
        const match = /^data:([^;]+);base64,(.+)$/.exec(sourceUrl);
        if (!match) {
            throw new Error('Invalid data URL for image upload');
        }
        const contentType = match[1] || 'image/png';
        const buffer = Buffer.from(match[2], 'base64');
        return storage.uploadFromBuffer(buffer, destinationPath, contentType);
    }
    return storage.uploadFromUrl(sourceUrl, destinationPath);
}

function buildDialogueInputText(script: string, speakers: DialogueSpeaker[]): string {
    const trimmed = script.trim();
    if (/^TTS the following/i.test(trimmed)) {
        return trimmed;
    }
    const names = speakers.map((s) => s.name.trim()).join(' and ');
    return `TTS the following conversation between ${names}:\n${trimmed}`;
}

function toAudioBillableInput(payload: AudioEventPayload): BillableMultiModalInput {
    switch (payload.type) {
        case 'text-to-speech':
            return {
                kind: 'tts',
                text: payload.params.text,
                model: payload.params.model,
                options: {
                    voice: payload.params.voice ?? 'Kore',
                    instructions: payload.params.instructions,
                },
            };
        case 'dialogue': {
            const speakers = payload.params.speakers.map((s) => ({
                name: s.name.trim(),
                voice: s.voice,
            }));
            return {
                kind: 'tts',
                text: buildDialogueInputText(payload.params.script, speakers),
                model: payload.params.model,
                options: {
                    // OpenRouter still requires a top-level voice; use the first speaker.
                    voice: speakers[0]?.voice ?? 'Kore',
                    instructions: payload.params.instructions,
                    speakers,
                },
            };
        }
        case 'generate-music':
            return {
                kind: 'music',
                prompt: payload.params.prompt,
                model: payload.params.model,
            };
    }
}

// ─── Image Generation ────────────────────────────────────────────────

export const handleImageGeneration = inngest.createFunction(
    {
        id: 'media-generate-image',
        retries: 0,
        triggers: [{ event: 'media/generate.image' }],
        onFailure: async ({ event }) => {
            const data = event.data.event.data as ImageEventData & { _reservationId?: string };
            const reservationId = data._reservationId;
            // Refund is best-effort: reservation id is not on the event today
            // (already refunded in the function catch). Keep for safety if added later.
            if (reservationId) {
                await safeRefund(reservationId, 'image-generation-failed');
            }
            if (data.requestId) {
                await commitRequest(data.requestId, 'error');
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as ImageEventData;
        const {
            requestId,
            projectId,
            organizationId,
            userId,
            prompt,
            model,
            aspectRatio,
            referenceImages,
            numVariations,
        } = data;

        const billableInput: BillableMultiModalInput = {
            kind: 'image',
            model,
            prompt,
            aspectRatio,
            n: numVariations,
            referenceUrls: referenceImages,
        };

        const reservation = await step.run('reserve-credits', async () => {
            const estimatedCredits = await multimodal.estimateCost(billableInput);
            const idempotencyKey = multimodal.idempotencyKey(billableInput, {
                organizationId,
                userId,
                metadata: { runId: requestId },
            });
            const res = await billingService.reserve({
                organizationId,
                userId,
                operation: 'media:image',
                estimatedCredits,
                ttlMs: SYNC_RESERVATION_TTL_MS,
                idempotencyKey,
                metadata: { requestId, projectId, kind: 'image' },
            });
            return { id: res.id, estimatedCredits: estimatedCredits.toString() };
        });

        let result;
        try {
            result = await step.run('generate-image', async () => {
                try {
                    const billCtx = {
                        organizationId,
                        userId,
                        signal: new AbortController().signal,
                        reservationId: reservation.id,
                    };
                    const billable = await multimodal.execute(billableInput, billCtx);
                    if (billable.output.kind !== 'image') {
                        throw new Error('Unexpected multimodal output kind for image');
                    }
                    return {
                        urls: billable.output.urls,
                        providerCostUsd: billable.output.costUsd,
                        actualCredits: billable.actualCredits.toString(),
                    };
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });
        } catch (error) {
            await step.run('refund-on-error', () => safeRefund(reservation.id, 'image-execute-error'));
            throw error;
        }

        await step.run('settle-credits', () =>
            billingService.settle({
                reservationId: reservation.id,
                actualCredits: BigInt(result.actualCredits),
                metadata: { requestId, providerCostUsd: result.providerCostUsd },
            }),
        );

        const uploads = await step.run('upload-to-gcs', async () => {
            const uploaded = [];
            for (let i = 0; i < result.urls.length; i++) {
                const imgName = result.urls[i].startsWith('data:')
                    ? `image-${uuidv4().slice(0, 8)}.png`
                    : (result.urls[i].split('/').pop() ?? `image-${uuidv4().slice(0, 8)}.png`);
                const destPath = storage.buildStoragePath('images', imgName);
                const upload = await uploadImageSource(result.urls[i], destPath);
                uploaded.push(upload);
            }
            return uploaded;
        });

        const assets = await step.run('save-assets', async () => {
            const newAssets: Asset[] = [];
            for (const upload of uploads) {
                const fileMetadata = await storage.getFileMetadata(upload.storageKey);
                const assetName = upload.storageKey.split('/').pop() ?? `image-${uuidv4().slice(0, 8)}.png`;
                const asset = await repo.createAsset({
                    projectId,
                    name: assetName,
                    type: 'image',
                    url: upload.url,
                    source: 'ai-generated',
                    generationRequestId: requestId,
                    metadata: fileMetadata,
                    storageKey: upload.storageKey,
                });
                await writeStreamData(requestId, { runId: requestId, event: 'asset', data: asset });
                newAssets.push(asset);
            }

            await commitRequest(requestId, 'finished');
            return newAssets;
        });

        return { requestId, assets, reservationId: reservation.id };
    },
);

// ─── Audio Generation ────────────────────────────────────────────────

export const handleAudioGeneration = inngest.createFunction(
    {
        id: 'media-generate-audio',
        retries: 0,
        triggers: [{ event: 'media/generate.audio' }],
        onFailure: async ({ event }) => {
            const data = event.data.event.data as AudioEventData & { _reservationId?: string };
            const reservationId = data._reservationId;
            if (reservationId) {
                await safeRefund(reservationId, 'audio-generation-failed');
            }
            if (data.requestId) {
                await commitRequest(data.requestId, 'error');
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as AudioEventData;
        const { requestId, projectId, organizationId, userId, payload } = data;
        const billableInput = toAudioBillableInput(payload);
        const operation =
            billableInput.kind === 'music' ? 'media:music' : 'media:tts';

        const reservation = await step.run('reserve-credits', async () => {
            const estimatedCredits = await multimodal.estimateCost(billableInput);
            const idempotencyKey = multimodal.idempotencyKey(billableInput, {
                organizationId,
                metadata: { runId: requestId },
            });
            const res = await billingService.reserve({
                organizationId,
                userId,
                operation,
                estimatedCredits,
                ttlMs: SYNC_RESERVATION_TTL_MS,
                idempotencyKey,
                metadata: { requestId, projectId, kind: 'audio', type: payload.type },
            });
            return { id: res.id, estimatedCredits: estimatedCredits.toString() };
        });

        let result;
        try {
            result = await step.run('generate-and-upload-audio', async () => {
                try {
                    const billCtx = {
                        organizationId,
                        userId,
                        signal: new AbortController().signal,
                        reservationId: reservation.id,
                    };
                    const billable = await multimodal.execute(billableInput, billCtx);
                    if (billable.output.kind !== 'tts' && billable.output.kind !== 'music') {
                        throw new Error('Unexpected multimodal output kind for audio');
                    }
                    const buffer = Buffer.from(billable.output.audio);
                    const ext = billable.output.kind === 'tts' ? 'wav' : 'mp3';
                    const contentType = billable.output.kind === 'tts' ? 'audio/wav' : 'audio/mpeg';
                    const fileName = `audio-${uuidv4().slice(0, 8)}.${ext}`;
                    const destPath = storage.buildStoragePath('audios', fileName);
                    const uploaded = await storage.uploadFromBuffer(buffer, destPath, contentType);
                    return {
                        upload: uploaded,
                        actualCredits: billable.actualCredits.toString(),
                    };
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });
        } catch (error) {
            await step.run('refund-on-error', () => safeRefund(reservation.id, 'audio-execute-error'));
            throw error;
        }

        await step.run('settle-credits', () =>
            billingService.settle({
                reservationId: reservation.id,
                actualCredits: BigInt(result.actualCredits),
                metadata: { requestId },
            }),
        );

        const asset = await step.run('save-asset', async () => {
            const fileMetadata = await storage.getFileMetadata(result.upload.storageKey);
            const asset = await repo.createAsset({
                projectId,
                name: result.upload.storageKey.split('/').pop() ?? `audio-${uuidv4().slice(0, 8)}.wav`,
                type: 'audio',
                url: result.upload.url,
                source: 'ai-generated',
                generationRequestId: requestId,
                metadata: fileMetadata,
                storageKey: result.upload.storageKey,
            });
            await writeStreamData(requestId, { runId: requestId, event: 'asset', data: asset });
            await commitRequest(requestId, 'finished');
            return asset;
        });

        return { requestId, asset, reservationId: reservation.id };
    },
);

// ─── Video Generation ────────────────────────────────────────────────

export const handleVideoGeneration = inngest.createFunction(
    {
        id: 'media-generate-video',
        retries: 0,
        triggers: [{ event: 'media/generate.video' }],
        onFailure: async ({ event }) => {
            const data = event.data.event.data as VideoEventData & { _reservationId?: string };
            const requestId = data.requestId;
            const reservationId = data._reservationId;
            if (reservationId) {
                await safeRefund(reservationId, 'video-generation-failed');
            }
            if (requestId) {
                await commitRequest(requestId, 'error');
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as VideoEventData;
        const {
            requestId,
            projectId,
            organizationId,
            userId,
            prompt,
            model,
            duration,
            aspectRatio,
            referenceImage,
        } = data;

        const billableInput: BillableMultiModalInput = {
            kind: 'video',
            model,
            prompt,
            duration,
            aspectRatio,
            referenceUrl: referenceImage,
        };

        const reservation = await step.run('reserve-credits', async () => {
            const estimatedCredits = await multimodal.estimateCost(billableInput);
            const idempotencyKey = multimodal.idempotencyKey(billableInput, {
                organizationId,
                userId,
                metadata: { runId: requestId },
            });
            const res = await billingService.reserve({
                organizationId,
                userId,
                operation: 'media:video',
                estimatedCredits,
                ttlMs: VIDEO_RESERVATION_TTL_MS,
                idempotencyKey,
                metadata: { requestId, projectId, kind: 'video' },
            });
            return { id: res.id, estimatedCredits: estimatedCredits.toString() };
        });

        let submission;
        try {
            submission = await step.run('submit-video', async () => {
                try {
                    const handle = await videoClient.submitVideoGeneration({
                        model,
                        prompt,
                        duration,
                        aspectRatio,
                        referenceUrl: referenceImage,
                        idempotencyKey: `${organizationId}:${requestId}`,
                    });
                    return {
                        id: handle.id,
                        estimatedProviderCostUsd: handle.costEstimate.cost ?? 0,
                    };
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });
        } catch (error) {
            await step.run('refund-on-submit-error', () => safeRefund(reservation.id, 'video-submit-error'));
            throw error;
        }

        let videoUrl = '';
        let providerCostUsd = submission.estimatedProviderCostUsd;

        for (let attempt = 0; attempt < MAX_VIDEO_POLL_ATTEMPTS; attempt++) {
            await step.sleep(`wait-for-video-${attempt}`, VIDEO_POLL_INTERVAL);

            await step.run(`renew-reservation-${attempt}`, async () => {
                const current = await billingService.getReservation(reservation.id);
                if (!current || current.status !== 'reserved') return;
                const remainingMs = current.expiresAt.getTime() - Date.now();
                if (remainingMs > VIDEO_RESERVATION_TTL_MS * 0.2) return;
                await billingService.extend(reservation.id, VIDEO_RESERVATION_TTL_MS);
            });

            const pollResult = await step.run(`poll-video-${attempt}`, async () => {
                try {
                    return await videoClient.pollVideoGeneration(submission.id);
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });

            if (pollResult.status === 'completed') {
                videoUrl = pollResult.url;
                if (typeof pollResult.cost?.cost === 'number' && pollResult.cost.cost > 0) {
                    providerCostUsd = pollResult.cost.cost;
                }
                break;
            }

            if (pollResult.status === 'failed') {
                await step.run('refund-on-provider-failure', () => safeRefund(reservation.id, 'video-provider-failed'));
                return { requestId, status: 'failed' };
            }
        }

        if (!videoUrl) {
            await step.run('refund-on-timeout', () => safeRefund(reservation.id, 'video-poll-timeout'));
            return { requestId, status: 'failed' };
        }

        await step.run('settle-credits', () =>
            billingService.settle({
                reservationId: reservation.id,
                actualCredits: videoActualCredits(providerCostUsd),
                metadata: { requestId, providerCostUsd },
            }),
        );

        const upload = await step.run('upload-to-gcs', async () => {
            const destPath = storage.buildStoragePath('videos', `video-${submission.id}.mp4`);
            return storage.uploadFromUrl(videoUrl, destPath);
        });

        const asset = await step.run('save-asset', async () => {
            const fileMetadata = await storage.getFileMetadata(upload.storageKey);
            const asset = await repo.createAsset({
                projectId,
                name: upload.storageKey.split('/').pop() ?? `video-${uuidv4().slice(0, 8)}.mp4`,
                type: 'video',
                url: upload.url,
                source: 'ai-generated',
                generationRequestId: requestId,
                metadata: fileMetadata,
                storageKey: upload.storageKey,
            });
            await writeStreamData(requestId, { runId: requestId, event: 'asset', data: asset });
            await commitRequest(requestId, 'finished');
            return asset;
        });

        return { requestId, asset, reservationId: reservation.id };
    },
);
