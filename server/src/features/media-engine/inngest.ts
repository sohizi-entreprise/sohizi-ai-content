import { NonRetriableError } from 'inngest';
import { inngest } from '@/lib/inngest';
import { AudioGenerator } from './generators/audio-generator';
import { MediaGenerator } from './generators/media-generator';
import * as repo from './repo';
import * as storage from './storage';
import type { ImageSizePreset } from './generators/media-generator';
import { v4 as uuidv4 } from 'uuid';
import { Asset } from '@/db/schema';

type ImageEventData = {
    requestId: string;
    projectId: string;
    prompt: string;
    model: string;
    aspectRatio: ImageSizePreset;
    referenceImages?: string[];
    numVariations: number;
}

type AudioEventData = {
    requestId: string;
    projectId: string;
    prompt: string;
    audioType: 'speech' | 'sound-effect' | 'music' | 'dialogue';
}

type VideoEventData = {
    requestId: string;
    projectId: string;
    prompt: string;
    model: string;
    duration: number;
    aspectRatio: '16:9' | '9:16' | '1:1';
    referenceImage?: string;
}

const MAX_VIDEO_POLL_ATTEMPTS = 60;
const VIDEO_POLL_INTERVAL = '10s';

function isRetryable(error: unknown): boolean {
    if (error instanceof Error) {
        const msg = error.message;
        return msg.includes('429') || msg.includes('503')
            || msg.includes('rate limit') || msg.includes('Rate limit')
            || msg.includes('service unavailable') || msg.includes('Service Unavailable');
    }
    return false;
}

function wrapNonRetryable(error: unknown): never {
    if (isRetryable(error)) throw error;
    throw new NonRetriableError(
        error instanceof Error ? error.message : String(error),
        { cause: error instanceof Error ? error : undefined },
    );
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

// ─── Image Generation ────────────────────────────────────────────────

export const handleImageGeneration = inngest.createFunction(
    {
        id: 'media-generate-image',
        retries: 3,
        triggers: [{ event: 'media/generate.image' }],
        onFailure: async ({ event, error, step }) => {
            const data = event.data.event.data as Partial<ImageEventData>;
            const requestId = data.requestId;
            if (!requestId) return;

            await step.run('mark-generation-failed', () =>
                repo.updateGenerationRequest(requestId, {
                    status: 'failed',
                    error: getErrorMessage(error),
                }),
            );
        },
    },
    async ({ event, step }) => {
        const data = event.data as ImageEventData;
        const { requestId, projectId, prompt, model, aspectRatio, referenceImages, numVariations } = data;

        await step.run('mark-processing', () =>
            repo.updateGenerationRequest(requestId, { status: 'processing' }),
        );

        const generator = new MediaGenerator(model);

        const result = await step.run('generate-image', async () => {
            try {
                if (referenceImages && referenceImages.length > 0) {
                    return await generator.imageToImage({
                        model,
                        prompt,
                        images: referenceImages,
                        aspectRatio,
                        numVariations,
                    });
                }
                return await generator.textToImage({
                    model,
                    prompt,
                    aspectRatio,
                    numVariations,
                });
            } catch (error) {
                wrapNonRetryable(error);
            }
        });

        const uploads = await step.run('upload-to-gcs', async () => {
            const uploaded = [];
            for (let i = 0; i < result.urls.length; i++) {
                const imgName = result.urls[i].split('/').pop() ?? `image-${uuidv4().slice(0, 8)}.png`;
                const destPath = storage.buildStoragePath('images', imgName);
                const upload = await storage.uploadFromUrl(result.urls[i], destPath);
                uploaded.push(upload);
            }
            return uploaded;
        });

        const assets = await step.run('save-assets', async () => {
            const assets: Asset[] = [];
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
                assets.push(asset);
            }

            await repo.updateGenerationRequest(requestId, { status: 'completed' });
            return assets;
        });

        return { requestId, assets };
    },
);

// ─── Audio Generation ────────────────────────────────────────────────

export const handleAudioGeneration = inngest.createFunction(
    {
        id: 'media-generate-audio',
        retries: 3,
        triggers: [{ event: 'media/generate.audio' }],
        onFailure: async ({ event, error, step }) => {
            const data = event.data.event.data as Partial<AudioEventData>;
            const requestId = data.requestId;
            if (!requestId) return;

            await step.run('mark-generation-failed', () =>
                repo.updateGenerationRequest(requestId, {
                    status: 'failed',
                    error: getErrorMessage(error),
                }),
            );
        },
    },
    async ({ event, step }) => {
        const data = event.data as AudioEventData;
        const { requestId, projectId, prompt, audioType } = data;

        await step.run('mark-processing', () =>
            repo.updateGenerationRequest(requestId, { status: 'processing' }),
        );

        const audioGenerator = new AudioGenerator();

        const upload = await step.run('generate-and-upload-audio', async () => {
            let audioResult;
            try {
                switch (audioType) {
                    case 'speech':
                        audioResult = await audioGenerator.generateSpeech(prompt);
                        break;
                    case 'sound-effect':
                        audioResult = await audioGenerator.generateSoundEffect(prompt);
                        break;
                    case 'music':
                        audioResult = await audioGenerator.generateMusic(prompt);
                        break;
                    case 'dialogue':
                        audioResult = await audioGenerator.generateDialogue(prompt);
                        break;
                    default:
                        throw new NonRetriableError(`Unknown audio type: ${audioType}`);
                }
            } catch (error) {
                if (error instanceof NonRetriableError) throw error;
                wrapNonRetryable(error);
            }

            const file = audioResult.file;
            const buffer = Buffer.from(await file.arrayBuffer());
            const destPath = storage.buildStoragePath('audios', file.name);
            return storage.uploadFromBuffer(buffer, destPath, file.type);
        });

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

            await repo.updateGenerationRequest(requestId, { status: 'completed' });
            return asset;
        });

        return { requestId, asset };
    },
);

// ─── Video Generation ────────────────────────────────────────────────

export const handleVideoGeneration = inngest.createFunction(
    {
        id: 'media-generate-video',
        retries: 3,
        triggers: [{ event: 'media/generate.video' }],
        onFailure: async ({ event, error, step }) => {
            const data = event.data.event.data as Partial<VideoEventData>;
            const requestId = data.requestId;
            if (!requestId) return;

            await step.run('mark-generation-failed', () =>
                repo.updateGenerationRequest(requestId, {
                    status: 'failed',
                    error: getErrorMessage(error),
                }),
            );
        },
    },
    async ({ event, step }) => {
        const data = event.data as VideoEventData;
        const { requestId, projectId, prompt, model, duration, aspectRatio, referenceImage } = data;

        await step.run('mark-processing', () =>
            repo.updateGenerationRequest(requestId, { status: 'processing' }),
        );

        const generator = new MediaGenerator(model);

        const submission = await step.run('submit-video', async () => {
            try {
                const inputReference = referenceImage
                    ? { image_url: referenceImage }
                    : undefined;

                return await generator.submitVideoGeneration({
                    model,
                    prompt,
                    duration,
                    aspectRatio,
                    inputReference,
                });
            } catch (error) {
                wrapNonRetryable(error);
            }
        });

        let videoUrl = '';

        for (let attempt = 0; attempt < MAX_VIDEO_POLL_ATTEMPTS; attempt++) {
            await step.sleep(`wait-for-video-${attempt}`, VIDEO_POLL_INTERVAL);

            const pollResult = await step.run(`poll-video-${attempt}`, async () => {
                try {
                    return await generator.pollVideoGeneration(submission.id);
                } catch (error) {
                    wrapNonRetryable(error);
                }
            });

            if (pollResult.status === 'completed') {
                videoUrl = pollResult.url;
                break;
            }

            if (pollResult.status === 'failed') {
                await step.run('mark-failed', () =>
                    repo.updateGenerationRequest(requestId, {
                        status: 'failed',
                        error: 'Video generation failed at provider',
                    }),
                );
                return { requestId, status: 'failed' };
            }
        }

        if (!videoUrl) {
            await step.run('mark-timeout', () =>
                repo.updateGenerationRequest(requestId, {
                    status: 'failed',
                    error: 'Video generation timed out',
                }),
            );
            return { requestId, status: 'failed' };
        }

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

            await repo.updateGenerationRequest(requestId, { status: 'completed' });
            return asset;
        });

        return { requestId, asset };
    },
);
