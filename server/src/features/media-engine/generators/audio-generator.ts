import { randomUUID } from 'crypto';
import { ElevenLabsClient, ElevenLabsError } from '@elevenlabs/elevenlabs-js';
import {
    MediaError,
    MediaConfigurationError,
    MediaGenerationFailedError,
    MediaRateLimitError,
    MediaServiceUnavailableError,
    MediaProviderError,
    wrapAsMediaError,
} from '../errors';

type ElevenLabsErrorDetail = {
    type?: string;
    code?: string;
    message?: string;
    request_id?: string;
}

/**
 * Wraps ElevenLabs SDK errors into appropriate MediaError subclasses.
 * Uses the error's statusCode and detail.type for reliable classification.
 */
function wrapElevenLabsError(error: unknown, context: string): MediaError {
    if (error instanceof ElevenLabsError) {
        const detail = (error.body as { detail?: ElevenLabsErrorDetail })?.detail;
        const message = detail?.message || error.message;
        const fullMessage = `${context}: ${message}`;

        if (detail?.type === 'rate_limit_error' || error.statusCode === 429) {
            return new MediaRateLimitError(fullMessage, error);
        }

        if (error.statusCode === 502 || error.statusCode === 503 || error.statusCode === 504) {
            return new MediaServiceUnavailableError(fullMessage, error);
        }

        return new MediaProviderError(fullMessage, error.statusCode, error);
    }

    return wrapAsMediaError(error, { context });
}

type Cost = {
    cost: number | null;
    currency: 'credits';
    estimated: boolean;
}

type AudioTiming = {
    start: number;
    end: number;
}

type CharacterAlignment = {
    characters: string[];
    characterStartTimesSeconds: number[];
    characterEndTimesSeconds: number[];
}

type RawCharacterAlignment = CharacterAlignment & {
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
}

export type AudioGenerationResponse = {
    file: File;
    cost: Cost;
    requestId?: string;
    timing?: AudioTiming;
    alignment?: CharacterAlignment | null;
    normalizedAlignment?: CharacterAlignment | null;
}

type RawAudioResponse<T> = {
    data: T;
    rawResponse: Response;
}

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const DEFAULT_SPEECH_MODEL_ID = 'eleven_multilingual_v2';
const DEFAULT_DIALOGUE_MODEL_ID = 'eleven_v3';
const DEFAULT_SOUND_MODEL_ID = 'eleven_text_to_sound_v2';
const DEFAULT_MUSIC_LENGTH_MS = 10_000;
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';
const MP3_MIME_TYPE = 'audio/mpeg';

export class AudioGenerator {
    private client: ElevenLabsClient | undefined;

    async generateSpeech(prompt: string): Promise<AudioGenerationResponse> {
        const voiceId = this.getVoiceId();
        let response;
        try {
            response = await this.withRawResponse(
                this.getClient().textToSpeech.convert(voiceId, {
                    text: prompt,
                    modelId: process.env.ELEVENLABS_SPEECH_MODEL_ID ?? DEFAULT_SPEECH_MODEL_ID,
                    outputFormat: DEFAULT_OUTPUT_FORMAT,
                }),
            );
        } catch (error) {
            throw wrapElevenLabsError(error, 'Speech generation failed');
        }

        return this.toAudioResponse(response, {
            filenamePrefix: 'speech',
            fallbackCost: this.characterCost(prompt),
        });
    }

    async generateSpeechWithTiming(prompt: string, timing: AudioTiming): Promise<AudioGenerationResponse> {
        const voiceId = this.getVoiceId();
        let response;
        try {
            response = await this.withRawResponse(
                this.getClient().textToSpeech.convertWithTimestamps(voiceId, {
                    text: prompt,
                    modelId: process.env.ELEVENLABS_SPEECH_MODEL_ID ?? DEFAULT_SPEECH_MODEL_ID,
                    outputFormat: DEFAULT_OUTPUT_FORMAT,
                }),
            );
        } catch (error) {
            throw wrapElevenLabsError(error, 'Speech with timing generation failed');
        }

        const audio = this.getAudioBase64(response.data);
        return {
            file: await this.createAudioFile(audio, 'speech-with-timing'),
            cost: this.getCreditCost(response.rawResponse, this.characterCost(prompt)),
            requestId: response.rawResponse.headers.get('request-id') ?? undefined,
            timing,
            alignment: this.getAlignment(response.data, 'alignment'),
            normalizedAlignment: this.getAlignment(response.data, 'normalizedAlignment'),
        };
    }

    async generateSoundEffect(prompt: string): Promise<AudioGenerationResponse> {
        let response;
        try {
            response = await this.withRawResponse(
                this.getClient().textToSoundEffects.convert({
                    text: prompt,
                    modelId: process.env.ELEVENLABS_SOUND_MODEL_ID ?? DEFAULT_SOUND_MODEL_ID,
                }),
            );
        } catch (error) {
            throw wrapElevenLabsError(error, 'Sound effect generation failed');
        }

        return this.toAudioResponse(response, {
            filenamePrefix: 'sound-effect',
        });
    }

    async generateMusic(prompt: string): Promise<AudioGenerationResponse> {
        const musicLengthMs = this.getMusicLengthMs();
        let response;
        try {
            response = await this.withRawResponse(
                this.getClient().music.composeDetailed({
                    prompt,
                    musicLengthMs,
                }),
            );
        } catch (error) {
            throw wrapElevenLabsError(error, 'Music generation failed');
        }

        return this.toAudioResponse(response, {
            filenamePrefix: 'music',
        });
    }

    async generateDialogue(prompt: string): Promise<AudioGenerationResponse> {
        let response;
        try {
            response = await this.withRawResponse(
                this.getClient().textToDialogue.convert({
                    inputs: this.getDialogueInputs(prompt),
                    modelId: process.env.ELEVENLABS_DIALOGUE_MODEL_ID ?? DEFAULT_DIALOGUE_MODEL_ID,
                }),
            );
        } catch (error) {
            throw wrapElevenLabsError(error, 'Dialogue generation failed');
        }

        return this.toAudioResponse(response, {
            filenamePrefix: 'dialogue',
            fallbackCost: this.characterCost(prompt),
        });
    }

    async generateDialogueWithTiming(prompt: string, timing: AudioTiming): Promise<AudioGenerationResponse> {
        const response = await this.generateDialogue(prompt);
        return {
            ...response,
            timing,
        };
    }

    private getClient(): ElevenLabsClient {
        if (this.client) {
            return this.client;
        }

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
            throw new MediaConfigurationError('ELEVENLABS_API_KEY is required to generate audio.');
        }

        this.client = new ElevenLabsClient({ apiKey });
        return this.client;
    }

    private async withRawResponse<T>(request: Promise<T> | { withRawResponse: () => Promise<RawAudioResponse<T>> }): Promise<RawAudioResponse<T>> {
        if (this.hasRawResponse(request)) {
            return request.withRawResponse();
        }

        const data = await request;
        return {
            data,
            rawResponse: new Response(),
        };
    }

    private hasRawResponse<T>(request: Promise<T> | { withRawResponse: () => Promise<RawAudioResponse<T>> }): request is { withRawResponse: () => Promise<RawAudioResponse<T>> } {
        return typeof (request as { withRawResponse?: unknown }).withRawResponse === 'function';
    }

    private async toAudioResponse<T>(
        response: RawAudioResponse<T>,
        options: { filenamePrefix: string; fallbackCost?: Cost },
    ): Promise<AudioGenerationResponse> {
        return {
            file: await this.createAudioFile(response.data, options.filenamePrefix),
            cost: this.getCreditCost(response.rawResponse, options.fallbackCost),
            requestId: response.rawResponse.headers.get('request-id') ?? undefined,
        };
    }

    private async createAudioFile(audio: unknown, filenamePrefix: string): Promise<File> {
        const blob = await this.toBlob(audio);
        return new File([blob], `${filenamePrefix}-${randomUUID()}.mp3`, {
            type: blob.type || MP3_MIME_TYPE,
        });
    }

    private async toBlob(audio: unknown): Promise<Blob> {
        if (audio instanceof Blob) {
            return audio;
        }

        if (audio instanceof ArrayBuffer) {
            return new Blob([audio], { type: MP3_MIME_TYPE });
        }

        if (audio instanceof Uint8Array) {
            const bytes = new Uint8Array(audio.byteLength);
            bytes.set(audio);
            return new Blob([bytes.buffer], { type: MP3_MIME_TYPE });
        }

        if (audio instanceof ReadableStream) {
            return new Response(audio).blob();
        }

        if (typeof audio === 'string') {
            return this.base64ToBlob(audio);
        }

        throw new MediaGenerationFailedError('ElevenLabs returned an unsupported audio response.');
    }

    private base64ToBlob(base64Audio: string): Blob {
        const parts = base64Audio.split(',');
        const base64 = base64Audio.includes(',') ? parts[parts.length - 1] : base64Audio;
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: MP3_MIME_TYPE });
    }

    private getAudioBase64(response: unknown): string {
        const data = response as { audioBase64?: string; audio_base64?: string };
        const audio = data.audioBase64 ?? data.audio_base64;
        if (!audio) {
            throw new MediaGenerationFailedError('ElevenLabs timestamp response did not include audio.');
        }
        return audio;
    }

    private getAlignment(response: unknown, key: 'alignment' | 'normalizedAlignment'): CharacterAlignment | null {
        const data = response as {
            alignment?: RawCharacterAlignment | null;
            normalizedAlignment?: RawCharacterAlignment | null;
            normalized_alignment?: RawCharacterAlignment | null;
        };

        if (key === 'alignment') {
            return this.normalizeAlignment(data.alignment);
        }
        return this.normalizeAlignment(data.normalizedAlignment ?? data.normalized_alignment);
    }

    private normalizeAlignment(alignment?: RawCharacterAlignment | null): CharacterAlignment | null {
        if (!alignment) {
            return null;
        }

        return {
            characters: alignment.characters,
            characterStartTimesSeconds: alignment.characterStartTimesSeconds ?? alignment.character_start_times_seconds ?? [],
            characterEndTimesSeconds: alignment.characterEndTimesSeconds ?? alignment.character_end_times_seconds ?? [],
        };
    }

    private getCreditCost(response: Response, fallbackCost?: Cost): Cost {
        const headerValue =
            response.headers.get('x-character-count') ??
            response.headers.get('character-cost') ??
            response.headers.get('x-credit-cost');
        const cost = headerValue ? Number(headerValue) : NaN;

        if (Number.isFinite(cost)) {
            return {
                cost,
                currency: 'credits',
                estimated: false,
            };
        }

        return fallbackCost ?? {
            cost: null,
            currency: 'credits',
            estimated: true,
        };
    }

    private characterCost(text: string): Cost {
        return {
            cost: text.length,
            currency: 'credits',
            estimated: true,
        };
    }

    private getVoiceId(): string {
        return process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
    }

    private getMusicLengthMs(): number {
        const musicLengthMs = Number(process.env.ELEVENLABS_MUSIC_LENGTH_MS);
        return Number.isFinite(musicLengthMs) && musicLengthMs >= 3000 ? musicLengthMs : DEFAULT_MUSIC_LENGTH_MS;
    }

    private getDialogueInputs(prompt: string) {
        return [
            {
                text: prompt,
                voiceId: this.getVoiceId(),
            },
        ];
    }
}
