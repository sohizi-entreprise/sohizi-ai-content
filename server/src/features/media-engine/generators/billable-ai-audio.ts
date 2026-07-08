import {
    providerCostToCredits,
    providerCostToActualCredits,
} from './cost-utils';
import { getTranscriptionCost, getTextToSpeechCost, speechToText, SpeechToTextParams, textToSpeech, TextToSpeechParams, WordsWithText, getMusicCost, generateMusic } from './ai-audio';
import type { Billable, BillableContext, BillableResult, Credits } from '@/features/billing/types';
import { fastHash64 } from '@/utils/fast-hash';

export type AudioBillableInput = {
    type: 'speech-to-text';
    params: SpeechToTextParams & { audioDurationSeconds: number };
} | {
    type: 'text-to-speech';
    params: TextToSpeechParams;
} | {
    type: 'generate-music';
    params: {
        prompt: string;
    }
}

type AudioBillableOutput = {
    type: 'speech-to-text';
    result: string | WordsWithText;
} | {
    type: 'text-to-speech';
    result: ArrayBuffer;
} | {
    type: 'generate-music';
    result: ArrayBuffer;
}

const AUDIO_OVERHEAD_RATE = 0.2;
const ESTIMATE_OVERBOOKING_FACTOR = 1.15;

export const aiAudioBillable: Billable<AudioBillableInput, AudioBillableOutput> = {
    operation: 'media:ai-audio',
    timeoutMs: 5 * 60 * 1000,
    ttlMs: 30 * 60 * 1000,
    estimateCost(input: AudioBillableInput): Credits {
        let providerCostUsd = 0;
        switch (input.type) {
            case 'speech-to-text':{
                providerCostUsd = getTranscriptionCost(input.params.audioDurationSeconds || 0);
                break;
            }
            case 'text-to-speech': {
                providerCostUsd = getTextToSpeechCost(input.params.text);
                break;
            }
            case 'generate-music': {
                providerCostUsd = getMusicCost();
                break;
            }
            default:
                throw new Error('Invalid input type. Supported types are "speech-to-text" and "text-to-speech".');
        }
        return providerCostToCredits(providerCostUsd, {
            overheadRate: AUDIO_OVERHEAD_RATE,
            overbookingFactor: ESTIMATE_OVERBOOKING_FACTOR,
        })
    },
    async execute(input: AudioBillableInput, _ctx: BillableContext): Promise<BillableResult<AudioBillableOutput>> {
        switch (input.type) {
            case 'speech-to-text': {
                const output = await speechToText(input.params);
                return {
                    output: {
                        type: 'speech-to-text',
                        result: output.result,
                    },
                    actualCredits: providerCostToActualCredits(output.cost, {
                        overheadRate: AUDIO_OVERHEAD_RATE,
                    }),
                }
            }
            case 'text-to-speech':{
                const output = await textToSpeech(input.params);
                return {
                    output: {
                        type: 'text-to-speech',
                        result: output.result,
                    },
                    actualCredits: providerCostToActualCredits(output.cost, {
                        overheadRate: AUDIO_OVERHEAD_RATE,
                    }),
                }
            }
            case 'generate-music': {
                const output = await generateMusic(input.params.prompt);
                return {
                    output: {
                        type: 'generate-music',
                        result: output.result,
                    },
                    actualCredits: providerCostToActualCredits(output.cost, {
                        overheadRate: AUDIO_OVERHEAD_RATE,
                    }),
                }
            }
        }
    },
    idempotencyKey(input: AudioBillableInput, ctx: { organizationId: string; metadata?: Record<string, unknown> }): string {
        const runId = ctx.metadata?.runId ?? crypto.randomUUID();
        switch (input.type) {
            case 'speech-to-text':
                return `media:ai-audio:speech-to-text:${runId}:${fastHash64(input.params.url)}`;
            case 'text-to-speech':
                return `media:ai-audio:text-to-speech:${runId}:${fastHash64(input.params.text)}`;
            case 'generate-music':
                return `media:ai-audio:generate-music:${runId}:${fastHash64(input.params.prompt)}`;
        }
    },
}