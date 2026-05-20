import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import * as mediaEngineService from '@/features/media-engine/service';

type AudioType = 'speech' | 'sound-effect' | 'music' | 'dialogue';

const generateAudioPromptSchema = z.object({
    prompt: z.string().min(1).describe('The prompt to generate the audio'),
})

async function submitAudioGeneration(audioType: AudioType, prompt: string, projectId: string, userId: string) {
    const { requestId } = await mediaEngineService.generateAudio({
        projectId,
        prompt,
        audioType,
    }, userId);

    return `Audio submitted successfully. Here is the request ID: ${requestId}. This can take up to 2 min to complete. User will be notified when the audio is ready.`;
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export const generateSpeechTool = buildBaseTool({
    name: 'generateSpeech',
    description: 'Generates spoken narration or voiceover audio based on the prompt',
    inputSchema: generateAudioPromptSchema,
    execute: async ({ prompt }, {session}) => {
        try {
            const output = await submitAudioGeneration('speech', prompt, session.projectId, session.userId);
            return { success: true, output };
        } catch (error) {
            return { success: false, output: `Failed to generate speech: ${getErrorMessage(error)}` };
        }
    },
})

export const generateSoundEffectTool = buildBaseTool({
    name: 'generateSoundEffect',
    description: 'Generates a sound effect based on the prompt',
    inputSchema: generateAudioPromptSchema,
    execute: async ({ prompt }, {session}) => {
        try {
            const output = await submitAudioGeneration('sound-effect', prompt, session.projectId, session.userId);
            return { success: true, output };
        } catch (error) {
            return { success: false, output: `Failed to generate sound effect: ${getErrorMessage(error)}` };
        }
    },
})

export const generateMusicTool = buildBaseTool({
    name: 'generateMusic',
    description: 'Generates music based on the prompt',
    inputSchema: generateAudioPromptSchema,
    execute: async ({ prompt }, {session}) => {
        try {
            const output = await submitAudioGeneration('music', prompt, session.projectId, session.userId);
            return { success: true, output };
        } catch (error) {
            return { success: false, output: `Failed to generate music: ${getErrorMessage(error)}` };
        }
    },
})

export const generateAudioDialogueTool = buildBaseTool({
    name: 'generateAudioDialogue',
    description: 'Generates dialogue audio based on the prompt',
    inputSchema: generateAudioPromptSchema,
    execute: async ({ prompt }, {session}) => {
        try {
            const output = await submitAudioGeneration('dialogue', prompt, session.projectId, session.userId);
            return { success: true, output };
        } catch (error) {
            return { success: false, output: `Failed to generate dialogue: ${getErrorMessage(error)}` };
        }
    },
})
