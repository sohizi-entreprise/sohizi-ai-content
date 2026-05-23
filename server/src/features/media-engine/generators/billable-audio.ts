import type { Billable, BillableContext, BillableResult, Credits } from '@/features/billing/types';
import { AUDIO_OVERHEAD_RATE } from '@/features/billing/constants';
import { AudioGenerator, type AudioGenerationResponse } from './audio-generator';
import {
    estimateElevenLabsCostUsd,
    providerCostToCredits,
    providerCostToActualCredits,
    type ElevenLabsAudioType,
} from './cost-utils';

export type AudioBillableInput = {
    audioType: ElevenLabsAudioType;
    prompt: string;
    musicLengthMs?: number;
}

export type AudioBillableOutput = {
    response: AudioGenerationResponse;
    providerCostUsd: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * Convert an ElevenLabs cost (`response.cost.cost` in credits where
 * 1 credit ≈ 1 character) into a USD estimate using the multilingual
 * v2 rate. For sound effects we treat the response as a flat per-
 * generation cost, and for music as the configured duration cost.
 */
function actualCostUsd(audioType: ElevenLabsAudioType, prompt: string, response: AudioGenerationResponse, musicLengthMs?: number): number {
    const reported = typeof response.cost.cost === 'number' ? response.cost.cost : null;
    switch (audioType) {
        case 'speech':
        case 'dialogue': {
            const chars = reported ?? prompt.length;
            return estimateElevenLabsCostUsd(audioType, 'x'.repeat(chars));
        }
        case 'sound-effect':
            return estimateElevenLabsCostUsd('sound-effect', prompt);
        case 'music':
            return estimateElevenLabsCostUsd('music', prompt, { musicLengthMs });
    }
}

export const audioBillable: Billable<AudioBillableInput, AudioBillableOutput> = {
    operation: 'media:audio',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ttlMs: DEFAULT_TTL_MS,

    estimateCost(input: AudioBillableInput): Credits {
        const providerCostUsd = estimateElevenLabsCostUsd(input.audioType, input.prompt, {
            musicLengthMs: input.musicLengthMs,
        });
        return providerCostToCredits(providerCostUsd, {
            overheadRate: AUDIO_OVERHEAD_RATE,
        });
    },

    async execute(input: AudioBillableInput, _ctx: BillableContext): Promise<BillableResult<AudioBillableOutput>> {
        const generator = new AudioGenerator();

        let response: AudioGenerationResponse;
        switch (input.audioType) {
            case 'speech':
                response = await generator.generateSpeech(input.prompt);
                break;
            case 'sound-effect':
                response = await generator.generateSoundEffect(input.prompt);
                break;
            case 'music':
                response = await generator.generateMusic(input.prompt);
                break;
            case 'dialogue':
                response = await generator.generateDialogue(input.prompt);
                break;
        }

        const providerCostUsd = actualCostUsd(input.audioType, input.prompt, response, input.musicLengthMs);
        const actualCredits = providerCostToActualCredits(providerCostUsd, {
            overheadRate: AUDIO_OVERHEAD_RATE,
        });

        return {
            output: { response, providerCostUsd },
            actualCredits,
        };
    },

    idempotencyKey(input: AudioBillableInput, ctx: { organizationId: string; userId?: string | null }): string {
        const promptHash = simpleHash(input.prompt);
        return `media:audio:${ctx.organizationId}:${input.audioType}:${promptHash}`;
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
