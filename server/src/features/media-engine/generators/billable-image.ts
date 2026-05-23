import type { Billable, BillableContext, BillableResult, Credits } from '@/features/billing/types';
import { IMAGE_OVERHEAD_RATE } from '@/features/billing/constants';
import { MediaGenerator, imageSizeMap, type ImageSizePreset } from './media-generator';
import {
    lumenDryRun,
    microsToDollars,
    providerCostToCredits,
    providerCostToActualCredits,
} from './cost-utils';

export type ImageBillableInput = {
    model: string;
    prompt: string;
    aspectRatio?: ImageSizePreset;
    numVariations?: number;
    images?: string[]; // when present -> image-to-image (edit)
}

export type ImageBillableOutput = {
    urls: string[];
    providerCostUsd: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;          // 2 minutes
const DEFAULT_TTL_MS = 30 * 60 * 1000;       // 30 minutes
// Fallback per-image cost used when the Lumenfall dryRun endpoint is
// unavailable. Sized generously so we still overbook.
const FALLBACK_USD_PER_IMAGE = 0.10;

export const imageBillable: Billable<ImageBillableInput, ImageBillableOutput> = {
    operation: 'media:image',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ttlMs: DEFAULT_TTL_MS,

    async estimateCost(input: ImageBillableInput): Promise<Credits> {
        const numVariations = input.numVariations ?? 1;
        const aspectRatio = input.aspectRatio ?? 'auto';
        const isEdit = !!(input.images && input.images.length > 0);
        const path = isEdit ? '/images/edits' : '/images/generations';

        const dryRunBody: Record<string, unknown> = {
            model: input.model,
            prompt: input.prompt,
            size: imageSizeMap[aspectRatio],
            n: numVariations,
        };

        const dryRun = await lumenDryRun(path, dryRunBody);
        const providerCostUsd = dryRun
            ? microsToDollars(dryRun.total_cost_micros)
            : FALLBACK_USD_PER_IMAGE * numVariations;

        return providerCostToCredits(providerCostUsd, {
            overheadRate: IMAGE_OVERHEAD_RATE,
        });
    },

    async execute(input: ImageBillableInput, _ctx: BillableContext): Promise<BillableResult<ImageBillableOutput>> {
        const generator = new MediaGenerator(input.model);
        const isEdit = !!(input.images && input.images.length > 0);

        const result = isEdit
            ? await generator.imageToImage({
                model: input.model,
                prompt: input.prompt,
                images: input.images!,
                aspectRatio: input.aspectRatio,
                numVariations: input.numVariations,
            })
            : await generator.textToImage({
                model: input.model,
                prompt: input.prompt,
                aspectRatio: input.aspectRatio,
                numVariations: input.numVariations,
            });

        const providerCostUsd = result.cost.cost ?? 0;
        const actualCredits = providerCostToActualCredits(providerCostUsd, {
            overheadRate: IMAGE_OVERHEAD_RATE,
        });

        return {
            output: {
                urls: result.urls,
                providerCostUsd,
            },
            actualCredits,
        };
    },

    idempotencyKey(input: ImageBillableInput, ctx: { organizationId: string; userId?: string | null }): string {
        const promptHash = simpleHash(`${input.prompt}|${(input.images ?? []).join(',')}`);
        const aspectRatio = input.aspectRatio ?? 'auto';
        const numVariations = input.numVariations ?? 1;
        return `media:image:${ctx.organizationId}:${input.model}:${aspectRatio}:${numVariations}:${promptHash}`;
    },
}

function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}
