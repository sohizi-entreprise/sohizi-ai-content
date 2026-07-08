import openAIClient from "@/lib/open-ai-client";
import { APIError } from "openai";
import { OpenRouter } from '@openrouter/sdk';

import { wrapAsMediaError } from '../errors';
import { TranscriptionCreateParamsNonStreaming, TranscriptionWord } from "openai/resources/audio/transcriptions";

export type SpeechToTextParams = {
    url: string;
    model?: string;
    mode: 'caption' | 'transcript';
}

export type TextToSpeechParams = {
    text: string;
    model?: string;
    voice?: string;
    instructions?: string;
}

type ResultWithCostInUSD<T> = {
    result: T;
    cost: number;
}

export type WordsWithText = {
    words: TranscriptionWord[];
    text: string;
}
 
export const speechToText = async ({url, model='whisper-1', mode}: SpeechToTextParams) : Promise<ResultWithCostInUSD<string | WordsWithText>> => {
    try {
        const file = await getFileFromUrl(url);
        if(!file){
            throw new Error("Failed to get file from url");
        }
        
        const options: TranscriptionCreateParamsNonStreaming<"verbose_json"> = {
            model: model,
            file,
        }
        if(mode === 'caption'){
            options.response_format = "verbose_json";
            options.timestamp_granularities = ["word"];
        }
        const transcript = await openAIClient.audio.transcriptions.create(options);

        const usage = transcript.usage;
        const duration = usage?.seconds ?? 0;

        const cost = getTranscriptionCost(duration);

        if(mode==="caption"){
            const words = transcript.words;
            if(!words){
                throw new Error("No words found in transcript");
            }
            return {
                result: {words, text: transcript.text},
                cost,
            }
        }
        return {
            result: transcript.text,
            cost,
        }
    
    } catch (error) {
        let status: number | undefined;
        let context = "Speech to text failed";
        if(error instanceof APIError){
            status = error.status;
            context = error.message;
        }
        throw wrapAsMediaError(error, {status, context});
    }
}


export const textToSpeech = async ({text, model='gpt-4o-mini-tts-2025-12-15', voice='alloy', instructions}: TextToSpeechParams) : Promise<ResultWithCostInUSD<ArrayBuffer>> => {
    try {
        const content = await openAIClient.audio.speech.create({
            model: model,
            input: text,
            voice,
            response_format: "mp3",
            instructions,
        });
        const arrayBuffer = await content.arrayBuffer()
        return {
            result: arrayBuffer,
            cost: getTextToSpeechCost(text),
        }
    } catch (error) {
        let status: number | undefined;
        let context = "Text to speech failed";
        if(error instanceof APIError){
            status = error.status;
            context = error.message;
        }
        throw wrapAsMediaError(error, {status, context});
    }
}

const MUSIC_MODELS = [
    {
        id: 'google/lyria-3-clip-preview',
        costPerSong: 0.04
    },
    {
        id: 'google/lyria-3-pro-preview',
        costPerSong: 0.08
    }
]

export const getMusicCost = () => {
    return MUSIC_MODELS[0].costPerSong;
}

export const generateMusic = async(prompt: string) => {
    const model = MUSIC_MODELS[0].id;

    const client = new OpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY,
    });
    const stream = await client.chat.send({
        chatRequest: {
            model,
            stream: true,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            modalities: ['audio'],
        }
    });

    const audioChunks: string[] = [];
    let cost = 0;
    for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.audio?.data) {
            audioChunks.push(delta.audio.data);
        }
        if (chunk.usage?.cost) {
            cost = chunk.usage.cost;
        }
    }

    if (audioChunks.length === 0) {
        throw new Error("No audio found in response");
    }

    const buffer = Buffer.from(audioChunks.join(''), 'base64');
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
    );
    return {
        result: arrayBuffer,
        cost,
    }
}

async function getFileFromUrl(url: string): Promise<File | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            console.error(
                `Failed to fetch audio for transcription (${response.status}): ${body.slice(0, 200)}`,
            );
            return null;
        }
        const blob = await response.blob();
        const type = blob.type || 'audio/mpeg';
        return new File([blob], 'audio.mp3', { type });
    } catch (error) {
        console.error(error);
        return null;
    }
}


export function getTranscriptionCost(durationSeconds: number) {
    // For whisper-1, we charge $0.006 per minute
    const ratePerSecond = 0.006 / 60;
    return durationSeconds * ratePerSecond;
}


export function getTextToSpeechCost(text: string) {
    // For  gpt-4o-mini-tts-2025-12-15, they charge $0.60/M characters
    const ratePer1MCharacters = 0.60;
    return (text.length / 1_000_000) * ratePer1MCharacters;
}


// In a 1-second audio clip at normal conversational speed, you can expect an average of 12 to 15 characters (including spaces)
export function estimateAudioSeconds(text: string, charsPerSecond = 14): number {
    return text.trim().length / charsPerSecond;
}