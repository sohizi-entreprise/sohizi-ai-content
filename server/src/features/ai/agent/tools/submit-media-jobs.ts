import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { success } from "./utils";
import { mediaConstants } from '@/constants';
import * as mediaEngineService from '@/features/media-engine/service';

const imageModels = z.enum(mediaEngineService.models.image);
const videoModels = z.enum(mediaEngineService.models.video);
const videoAspectRatios = ['16:9', '9:16', '1:1'] as const;

const imageJobSchema = z.object({
    type: z.literal('image'),
    prompt: z.string().min(1).describe('The prompt to generate the image'),
    model: imageModels.describe('The model to use. Default to Flux or gemini-3.1-flash-image-preview as they are faster and cheaper.'),
    aspectRatio: z.enum(mediaConstants.imageSizePresets).default('auto').describe('The aspect ratio of the image'),
    referenceImages: z.array(z.url()).max(5).optional().describe('Optional reference images. Maximum 5.'),
    numVariations: z.number().int().min(1).max(4).default(1).describe('Number of variations to generate. Maximum 4.'),
});

const videoJobSchema = z.object({
    type: z.literal('video'),
    prompt: z.string().min(1).describe('The prompt to generate the video'),
    model: videoModels.describe('The model to use for video generation'),
    duration: z.number().min(1).max(60).describe('Video duration in seconds (1-60)'),
    aspectRatio: z.enum(videoAspectRatios).default('16:9').describe('The aspect ratio of the video'),
    referenceImage: z.url().optional().describe('Optional reference image URL to guide generation'),
});

const mediaJobSchema = z.discriminatedUnion('type', [imageJobSchema, videoJobSchema]);

export type MediaJob = z.infer<typeof mediaJobSchema>;

const submitMediaJobsSchema = z.object({
    status: z.enum(['done', 'blocked']).describe('"done" = jobs are ready to submit. "blocked" = cannot proceed.'),
    jobs: z.array(mediaJobSchema).default([]).describe('The media jobs to submit. Leave empty when status is "blocked".'),
    message: z.string().describe('Super concise message to the user. If blocked, explain why.'),
});

export const submitMediaJobsTool = buildBaseTool({
    name: 'submitMediaJobs',
    description: 'End the execution loop. If status is "done", include all the media jobs the user requested. If status is "blocked", explain why you cannot proceed. Call this tool EXACTLY ONCE.',
    inputSchema: submitMediaJobsSchema,
    execute: async (input, { state }) => {
        state.finishRun();
        const output = input.status === 'done'
            ? JSON.stringify({ status: 'done', jobs: input.jobs })
            : JSON.stringify({ status: 'blocked', message: input.message });
        return success(output);
    },
});
