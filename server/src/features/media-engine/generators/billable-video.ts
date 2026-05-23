import type { BillableAsync, BillableContext, Credits } from '@/features/billing/types';
import { VIDEO_OVERHEAD_RATE } from '@/features/billing/constants';
import { MediaGenerator, type VideoSubmissionResponse } from './media-generator';
import {
    lumenDryRun,
    microsToDollars,
    providerCostToCredits,
    providerCostToActualCredits,
} from './cost-utils';

export type VideoBillableInput = {
    model: string;
    prompt: string;
    duration: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    resolution?: '720p' | '1080p';
    referenceImage?: string;
    numVariations?: number;
    idempotencyKey?: string;
}

export type VideoSubmissionHandle = {
    submission: VideoSubmissionResponse;
    /** Cost estimate (USD) used at reservation time, for later settle math. */
    estimatedProviderCostUsd: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;     // 10 minutes for submission only
const DEFAULT_TTL_MS = 60 * 60 * 1000;         // 1 hour to cover polling

// Conservative per-second fallback when dryRun is unavailable. Videos vary
// widely by model; pick a high-side estimate so we don't under-reserve.
const FALLBACK_USD_PER_SECOND = 0.20;

async function estimateProviderCostUsd(input: VideoBillableInput): Promise<number> {
    const numVariations = input.numVariations ?? 1;
    const aspectRatio = input.aspectRatio ?? '16:9';
    const resolution = input.resolution ?? '1080p';

    const dryRunBody: Record<string, unknown> = {
        model: input.model,
        prompt: input.prompt,
        aspect_ratio: aspectRatio,
        seconds: input.duration,
        n: numVariations,
        resolution,
    };
    if (input.referenceImage) {
        dryRunBody.input_reference = { image_url: input.referenceImage };
    }

    const dryRun = await lumenDryRun('/videos', dryRunBody);
    if (dryRun) {
        return microsToDollars(dryRun.total_cost_micros);
    }
    return FALLBACK_USD_PER_SECOND * input.duration * numVariations;
}

export const videoBillable: BillableAsync<VideoBillableInput, VideoSubmissionHandle> = {
    operation: 'media:video',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ttlMs: DEFAULT_TTL_MS,

    async estimateCost(input: VideoBillableInput): Promise<Credits> {
        const providerCostUsd = await estimateProviderCostUsd(input);
        return providerCostToCredits(providerCostUsd, {
            overheadRate: VIDEO_OVERHEAD_RATE,
        });
    },

    async submit(input: VideoBillableInput, _ctx: BillableContext): Promise<VideoSubmissionHandle> {
        const generator = new MediaGenerator(input.model);
        const submission = await generator.submitVideoGeneration({
            model: input.model,
            prompt: input.prompt,
            duration: input.duration,
            aspectRatio: input.aspectRatio,
            resolution: input.resolution,
            numVariations: input.numVariations,
            inputReference: input.referenceImage ? { image_url: input.referenceImage } : undefined,
            idempotencyKey: input.idempotencyKey,
        });
        const estimatedProviderCostUsd = submission.costEstimate.cost ?? await estimateProviderCostUsd(input);
        return { submission, estimatedProviderCostUsd };
    },

    idempotencyKey(input: VideoBillableInput, ctx: { organizationId: string; userId?: string | null }): string {
        if (input.idempotencyKey) return input.idempotencyKey;
        const promptHash = simpleHash(`${input.prompt}|${input.referenceImage ?? ''}`);
        const aspectRatio = input.aspectRatio ?? '16:9';
        const resolution = input.resolution ?? '1080p';
        return `media:video:${ctx.organizationId}:${input.model}:${aspectRatio}:${resolution}:${input.duration}:${promptHash}`;
    },
}

/**
 * Convert an actual provider USD cost (returned by the polling endpoint
 * on completion) into the final credit amount used for `billing.settle()`.
 */
export const videoActualCredits = (providerCostUsd: number): Credits => {
    return providerCostToActualCredits(providerCostUsd, {
        overheadRate: VIDEO_OVERHEAD_RATE,
    });
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
