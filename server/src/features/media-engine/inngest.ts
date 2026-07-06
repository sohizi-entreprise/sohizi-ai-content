import { NonRetriableError } from 'inngest';
import { inngest } from '@/lib/inngest/client';
import * as repo from './repo';
import * as streamRepo from '../generation-request/repo';
import * as storage from './storage';
import { MediaGenerator, type ImageSizePreset } from './generators/media-generator';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from '@/db/schema';
import { billingService } from '@/features/billing';
import { imageBillable } from './generators/billable-image';
import { audioBillable } from './generators/billable-audio';
import { videoBillable, videoActualCredits } from './generators/billable-video';
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
}

type AudioEventData = {
    requestId: string;
    projectId: string;
    organizationId: string;
    userId: string;
    prompt: string;
    audioType: 'speech' | 'sound-effect' | 'music' | 'dialogue';
}

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
}

const MAX_VIDEO_POLL_ATTEMPTS = 60;
const VIDEO_POLL_INTERVAL = '10s';
// TTLs mirror the values declared on the billables; reservations need at
// least 2x the wall-clock budget for the sweeper-safety check to pass.
const SYNC_RESERVATION_TTL_MS = 30 * 60 * 1000;        // 30 minutes
const VIDEO_RESERVATION_TTL_MS = 60 * 60 * 1000;       // 1 hour

/**
 * Determines if an error should trigger a retry.
 * Only MediaError instances with isRetriable=true are retriable.
 * All other errors (including generic Errors) are non-retriable.
 */
function shouldRetry(error: unknown): boolean {
    if (isMediaError(error)) {
        return error.isRetriable;
    }
    return false;
}

/**
 * Wraps errors appropriately for Inngest:
 * - MediaError with isRetriable=true: rethrow to trigger retry
 * - MediaError with isRetriable=false: wrap in NonRetriableError
 * - Any other error: wrap in NonRetriableError (no retry for unknown errors)
 */
function wrapNonRetryable(error: unknown): never {
    if (shouldRetry(error)) {
        throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;

    throw new NonRetriableError(message, { cause });
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
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
    const res = await decrementKey(requestId)
    if(res === 0){
        await repo.updateAssetRequest(requestId, { status });
        await removeStreamActive(requestId);
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
            if (reservationId) {
                await safeRefund(reservationId, 'image-generation-failed');
                await commitRequest(data.requestId, 'error')
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as ImageEventData;
        const { requestId, projectId, organizationId, userId, prompt, model, aspectRatio, referenceImages, numVariations } = data;

        const billableInput = {
            model,
            prompt,
            aspectRatio,
            numVariations,
            images: referenceImages,
        };

        const reservation = await step.run('reserve-credits', async () => {
            const estimatedCredits = await imageBillable.estimateCost(billableInput);
            const idempotencyKey = imageBillable.idempotencyKey(billableInput, { organizationId, userId });
            const res = await billingService.reserve({
                organizationId,
                userId,
                operation: imageBillable.operation,
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
                    const billable = await imageBillable.execute(billableInput, billCtx);
                    return {
                        urls: billable.output.urls,
                        providerCostUsd: billable.output.providerCostUsd,
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
                const imgName = result.urls[i].split('/').pop() ?? `image-${uuidv4().slice(0, 8)}.png`;
                const destPath = storage.buildStoragePath('images', imgName);
                const upload = await storage.uploadFromUrl(result.urls[i], destPath);
                uploaded.push(upload);
                // await writeStreamData(requestId, {runId: requestId, event:'media', data: {type: 'image', ...upload}});
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
                await writeStreamData(requestId, {runId: requestId, event:'asset', data: asset});
                newAssets.push(asset);
            }

            await commitRequest(requestId, 'finished')
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
        onFailure: async ({ event, error, step }) => {
            const data = event.data.event.data as Partial<AudioEventData> & { _reservationId?: string };
            const requestId = data.requestId;
            if (requestId) {
                await commitRequest(requestId, 'error')
            }
            const reservationId = data._reservationId;
            if (reservationId) {
                await step.run('refund-credits', () => safeRefund(reservationId, 'audio-generation-failed'));
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as AudioEventData;
        const { requestId, projectId, organizationId, userId, prompt, audioType } = data;

        await step.run('mark-processing', () =>
            streamRepo.updateGenerationRequest(requestId, { status: 'processing' }),
        );

        const billableInput = { audioType, prompt };

        const reservation = await step.run('reserve-credits', async () => {
            const estimatedCredits = await audioBillable.estimateCost(billableInput);
            const idempotencyKey = audioBillable.idempotencyKey(billableInput, { organizationId, userId });
            const res = await billingService.reserve({
                organizationId,
                userId,
                operation: audioBillable.operation,
                estimatedCredits,
                ttlMs: SYNC_RESERVATION_TTL_MS,
                idempotencyKey,
                metadata: { requestId, projectId, kind: 'audio', audioType },
            });
            return { id: res.id, estimatedCredits: estimatedCredits.toString() };
        });

        let upload;
        let actualCreditsStr = '0';
        let providerCostUsd = 0;
        try {
            const generated = await step.run('generate-and-upload-audio', async () => {
                let billable;
                try {
                    billable = await audioBillable.execute(billableInput, {
                        organizationId,
                        userId,
                        signal: new AbortController().signal,
                        reservationId: reservation.id,
                    });
                } catch (error) {
                    if (error instanceof NonRetriableError) throw error;
                    wrapNonRetryable(error);
                }

                const file = billable.output.response.file;
                const buffer = Buffer.from(await file.arrayBuffer());
                const destPath = storage.buildStoragePath('audios', file.name);
                const uploaded = await storage.uploadFromBuffer(buffer, destPath, file.type);
                return {
                    upload: uploaded,
                    actualCredits: billable.actualCredits.toString(),
                    providerCostUsd: billable.output.providerCostUsd,
                };
            });
            upload = generated.upload;
            actualCreditsStr = generated.actualCredits;
            providerCostUsd = generated.providerCostUsd;
        } catch (error) {
            await step.run('refund-on-error', () => safeRefund(reservation.id, 'audio-execute-error'));
            throw error;
        }

        await step.run('settle-credits', () =>
            billingService.settle({
                reservationId: reservation.id,
                actualCredits: BigInt(actualCreditsStr),
                metadata: { requestId, providerCostUsd },
            }),
        );

        const asset = await step.run('save-asset', async () => {
            const fileMetadata = await storage.getFileMetadata(upload.storageKey);
            const asset = await repo.createAsset({
                projectId,
                name: upload.storageKey.split('/').pop() ?? `audio-${uuidv4().slice(0, 8)}.mp3`,
                type: 'audio',
                url: upload.url,
                source: 'ai-generated',
                generationRequestId: requestId,
                metadata: fileMetadata,
                storageKey: upload.storageKey,
            });

            await commitRequest(requestId, 'finished')
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
                await commitRequest(requestId, 'error')
            }
        },
    },
    async ({ event, step }) => {
        const data = event.data as VideoEventData;
        const { requestId, projectId, organizationId, userId, prompt, model, duration, aspectRatio, referenceImage } = data;

        const billableInput = {
            model,
            prompt,
            duration,
            aspectRatio,
            referenceImage,
        };

        const reservation = await step.run('reserve-credits', async () => {
            const estimatedCredits = await videoBillable.estimateCost(billableInput);
            const idempotencyKey = videoBillable.idempotencyKey(billableInput, { organizationId, userId });
            const res = await billingService.reserve({
                organizationId,
                userId,
                operation: videoBillable.operation,
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
                    const handle = await videoBillable.submit(billableInput, {
                        organizationId,
                        userId,
                        signal: new AbortController().signal,
                        reservationId: reservation.id,
                    });
                    return {
                        id: handle.submission.id,
                        estimatedProviderCostUsd: handle.estimatedProviderCostUsd,
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

            // Keep the reservation alive while we poll. Sweeper would
            // otherwise refund + expire our reservation under us.
            await step.run(`renew-reservation-${attempt}`, async () => {
                const current = await billingService.getReservation(reservation.id);
                if (!current || current.status !== 'reserved') return;
                const remainingMs = current.expiresAt.getTime() - Date.now();
                if (remainingMs > VIDEO_RESERVATION_TTL_MS * 0.2) return;
                await billingService.extend(reservation.id, VIDEO_RESERVATION_TTL_MS);
            });

            const pollResult = await step.run(`poll-video-${attempt}`, async () => {
                try {
                    const generator = new MediaGenerator(model);
                    return await generator.pollVideoGeneration(submission.id);
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

            await commitRequest(requestId, 'finished')
            return asset;
        });

        return { requestId, asset, reservationId: reservation.id };
    },
);
