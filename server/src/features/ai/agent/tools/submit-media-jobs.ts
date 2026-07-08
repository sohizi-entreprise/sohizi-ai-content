import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { success } from "./utils";
import { mediaConstants } from '@/constants';
import { incrementKey } from "@/features/generation-request/stream-handler";
import { inngest } from "@/lib/inngest";

const models = {
    image: [
        'flux.2-max',
        'gpt-image-2',
        'gpt-image-1.5',
        'gemini-3.1-flash-image-preview',
        'gemini-3-pro-image-preview',
        'seedream-4.5',
        'seedream-5-lite'
    ],
    video: [
        'wan-2.6',
        'kling-v3',
        'seedance-2.0'
    ],
    videoToVideo: [
        'seedance-2.0'
    ],
}

const textToSpeechVoices = [
    'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse', 'marin', 'cedar'
]

const imageModels = z.enum(models.image);
const videoModels = z.enum(models.video);
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

const musicJobSchema = z.object({
    type: z.literal('music'),
    instructions: z.string().min(1).describe('A clear detailed prompt to generate the music'),
});

const textToSpeechJobSchema = z.object({
    type: z.literal('text-to-speech'),
    text: z.string().min(1).describe('The text to convert to speech'),
    voice: z.enum(textToSpeechVoices).describe('The voice to use for text to speech'),
    instructions: z.string().optional().describe('Optional instructions to guide the generation'),
});

const mediaJobSchema = z.discriminatedUnion('type', [imageJobSchema, videoJobSchema, musicJobSchema, textToSpeechJobSchema]);

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
    execute: async (input, { state, session }) => {
        if(state.isExitStatus){
            return success('Media generation was already submitted.');
        }

        state.finishRun();
        if(input.status === 'blocked'){
            return success('The user will be notified that the request cannot be processed at the moment.');
        }

        for (const job of input.jobs){
            await incrementKey(session.runId);
            switch(job.type){
                case 'image':
                    await inngest.send({
                        name: 'media/generate.image',
                        data: {
                            requestId: session.runId,
                            projectId: session.projectId,
                            organizationId: session.organizationId,
                            userId: session.userId,
                            prompt: job.prompt,
                            model: job.model,
                            aspectRatio: job.aspectRatio,
                            referenceImages: job.referenceImages,
                            numVariations: job.numVariations,
                        },
                    });
                    break;
                case 'video':
                    await inngest.send({
                        name: 'media/generate.video',
                        data: {
                            requestId: session.runId,
                            projectId: session.projectId,
                            organizationId: session.organizationId,
                            userId: session.userId,
                            prompt: job.prompt,
                            model: job.model,
                            duration: job.duration,
                            aspectRatio: job.aspectRatio,
                            referenceImage: job.referenceImage,
                        },
                    });
                    break;
                case 'music':
                    await inngest.send({
                        name: 'media/generate.audio',
                        data: {
                            requestId: session.runId,
                            projectId: session.projectId,
                            organizationId: session.organizationId,
                            userId: session.userId,
                            payload: {
                                type: 'generate-music',
                                params: {
                                    prompt: job.instructions,
                                },
                            },
                        },
                    });
                    break;
                case 'text-to-speech':
                    await inngest.send({
                        name: 'media/generate.audio',
                        data: {
                            requestId: session.runId,
                            projectId: session.projectId,
                            organizationId: session.organizationId,
                            userId: session.userId,
                            payload: {
                                type: 'text-to-speech',
                                params: {
                                    text: job.text,
                                    voice: job.voice,
                                    instructions: job.instructions,
                                },
                            },
                        },
                    });
                    break;
                // default:
                //     throw new Error(`Invalid job type: ${job.type}`);
            }
        }
        
        return success('The generation has kicked off.');
    },
});
