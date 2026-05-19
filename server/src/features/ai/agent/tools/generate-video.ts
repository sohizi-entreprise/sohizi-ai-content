import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import * as mediaEngineService from '@/features/media-engine/service';

const videoAspectRatios = ['16:9', '9:16', '1:1'] as const;

export const generateVideoSchema = z.object({
    prompt: z.string().min(1).describe('The prompt to generate the video'),
    model: z.string().min(1).describe('The model to use for the video generation'),
    duration: z.number().min(1).max(60).describe('The video duration in seconds. Must be between 1 and 60 seconds.'),
    aspectRatio: z.enum(videoAspectRatios).default('16:9').describe('The aspect ratio of the video'),
    referenceImage: z.url().optional().describe('Optional reference image URL to guide the video generation'),
})

export const generateVideoTool = buildBaseTool({
    name: 'generateVideo',
    description: 'Generates a video based on the prompt and optional reference image',
    inputSchema: generateVideoSchema,
    execute: async (input, {session}) => {
        const { prompt, model, duration, aspectRatio, referenceImage } = input;
        const projectId = session.projectId;
        try {
            const { requestId } = await mediaEngineService.generateVideo({
                projectId,
                prompt,
                model,
                duration,
                aspectRatio,
                referenceImage,
            });
            const msg = `Video submitted successfully. Here is the request ID: ${requestId}. This can take few minutes to complete. User will be notified when the video is ready.`;
            return { success: true, output: msg };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            return { success: false, output: `Failed to generate video: ${errorMsg}` };
        }
    },
})
