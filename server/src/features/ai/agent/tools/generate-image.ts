import { z } from "zod";
import { v4 as uuidv4 } from 'uuid';
import { buildBaseTool } from "./tool-definition";
import { mediaConstants } from '@/constants';
import type { ImageSizePreset } from '@/constants/media';
import { billingService, withBilling } from '@/features/billing';
import { createBillableMultiModalClient } from '@/features/ai/agent/utils/multi-llm-client';
import * as storage from '@/features/media-engine/storage';
import { failure, success } from "./utils";

const models = [
    {
        id: 'google/gemini-3.1-flash-image',
        description:
            'Default. Fast/cheap for drafts, iteration, simple scenes, and quick reference-guided edits. Prefer when volume or turnaround matters more than max fidelity.',
    },
    {
        id: 'openai/gpt-image-2',
        description:
            'Higher fidelity for photorealism, intricate multi-subject layouts, character sheets, and product/detail shots. Prefer when composition accuracy and realism matter more than speed/cost.',
    },
] as const;

const description = models.map(model => `${model.id}: ${model.description}`).join('\n');

export const generateImageSchema = z.object({
    model: z.enum(models.map(model => model.id)).default('google/gemini-3.1-flash-image').describe(`The model to use for the image generation. ${description}`),
    prompt: z.string().min(1).describe('The prompt to generate the image'),
    aspectRatio: z.enum(mediaConstants.imageSizePresets).default('auto').describe('The aspect ratio of the image'),
    referenceImages: z.array(z.url()).max(5).optional().describe('Optional reference images to use for the image generation. Maximum 5 reference images.'),
    numVariations: z.number().int().min(1).max(4).default(1).describe('The number of variations to generate. Maximum 4 variations.'),
})

export const generateImageTool = buildBaseTool({
    name: 'generateImage',
    description: 'Generates one or more images based on the prompt and reference images',
    inputSchema: generateImageSchema,
    execute: async (input: z.infer<typeof generateImageSchema>, { session, state, abortSignal }) => {
        const {
            model,
            prompt,
            aspectRatio,
            referenceImages,
            numVariations,
        } = input;

        try {
            const result = await generateAndStoreImage({
                organizationId: session.organizationId,
                userId: session.userId,
                prompt,
                model,
                aspectRatio,
                referenceImages,
                numVariations,
                runId: uuidv4(),
                signal: abortSignal,
            });

            const isMany = result.urls.length > 1;

            const msg = `Generated ${result.urls.length} image${isMany ? 's' : ''}. ${isMany ? 'Here are the URLs:' : 'Here is the URL:'}\n\n${result.urls.join('\n')}`;
    
            return success(msg);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return failure(`An error occurred while generating the image: ${errorMsg}`);
        }

    },
})

// ─── Standalone image generation (generate → bill → store) ───────────

const generateImage = withBilling(
    createBillableMultiModalClient({
        timeoutMs: 15 * 60 * 1000,
        ttlMs: 30 * 60 * 1000,
    }),
    billingService,
);

export type GenerateAndStoreImageInput = {
    organizationId: string;
    userId: string;
    prompt: string;
    model: string;
    aspectRatio?: ImageSizePreset;
    referenceImages?: string[];
    numVariations?: number;
    /** Used for billing idempotency; defaults to a random UUID. */
    runId?: string;
    signal?: AbortSignal;
};

export type GenerateAndStoreImageResult = {
    /** Public storage URLs for the uploaded images (one per variation). */
    urls: string[];
    storageKeys: string[];
    providerCostUsd: number;
};

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

/**
 * Generate image(s) via the billable multimodal client (reserve → execute → settle),
 * upload results to storage, and return the final public storage URL(s).
 */
export async function generateAndStoreImage(
    input: GenerateAndStoreImageInput,
): Promise<GenerateAndStoreImageResult> {
    const {
        organizationId,
        userId,
        prompt,
        model,
        aspectRatio = 'auto',
        referenceImages,
        numVariations = 1,
        runId = uuidv4(),
        signal,
    } = input;

    const output = await generateImage(
        {
            kind: 'image',
            model,
            prompt,
            aspectRatio,
            n: numVariations,
            referenceUrls: referenceImages,
        },
        {
            organizationId,
            userId,
            signal,
            metadata: { runId, kind: 'image' },
        },
    );

    if (output.kind !== 'image') {
        throw new Error('Unexpected multimodal output kind for image');
    }

    const uploaded = [];
    for (const sourceUrl of output.urls) {
        const imgName = sourceUrl.startsWith('data:')
            ? `image-${uuidv4().slice(0, 8)}.png`
            : (sourceUrl.split('/').pop() ?? `image-${uuidv4().slice(0, 8)}.png`);
        const destPath = storage.buildStoragePath('images', imgName);
        uploaded.push(await uploadImageSource(sourceUrl, destPath));
    }

    if(uploaded.length === 0){
        throw new Error('No images were generated');
    }

    return {
        urls: uploaded.map((u) => u.url),
        storageKeys: uploaded.map((u) => u.storageKey),
        providerCostUsd: output.costUsd,
    };
}
