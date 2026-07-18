import { z } from "zod";
import { buildLlmTool } from "./tool-definition";

const MAX_DURATION = 20 * 60; // 20 minutes

export const imageAnalyzerTool = buildLlmTool({
    name: 'imageAnalyzer',
    description: 'Analyze an image by its URL and return a summary based on the instructions provided',
    inputSchema: z.object({
        url: z.url().describe('The URL of the image to analyze'),
        instructions: z.string().describe('The instructions for the image analyzer'),
    }),
    
    config: {
        modelId: 'google/gemini-3.1-flash-lite-preview',
        modelConfig: {
            maxOutputTokens: 2000,
            reasoningEffort: 'low'
        },
        buildInput: (data) => {
            return [
                {
                    role: 'system',
                    content: ''
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: data.instructions
                        },
                        {
                            type: 'image',
                            image: data.url
                        }
                    ],
                },
            ];
        },
    },
})

export const videoAnalyzerTool = buildLlmTool({
    name: 'videoAnalyzer',
    description: 'Analyze a video file by its URL and return a summary based on the instructions provided',
    inputSchema: z.object({
        url: z.url().describe('The URL of the video file to analyze'),
        contentType: z.string().describe('The content type of the media file. e.g. video/mp4'),
        instructions: z.string().describe('The instructions for the video analyzer'),
        startSeconds: z.number().optional().describe('The start time of the video to analyze in seconds'),
        endSeconds: z.number().optional().describe('The end time of the video to analyze in seconds'),
    }),
    
    config: {
        modelId: 'google/gemini-3.1-flash-lite-preview',
        modelConfig: {
            maxOutputTokens: 2000,
            reasoningEffort: 'low'
        },
        buildInput: (data) => {
            const startOffset = data.startSeconds ?? 0;
            const endOffset = Math.min(data.endSeconds || MAX_DURATION, startOffset + MAX_DURATION);
            return [
                {
                    role: 'system',
                    content: ''
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: data.instructions
                        },
                        {
                            type: 'file',
                            data: data.url,
                            mediaType: data.contentType,
                            providerOptions: {
                                google: {
                                    videoMetadata: {
                                        fps: 1,
                                        startOffset: `${startOffset}s`,
                                        endOffset: `${endOffset}s`,
                                    }
                                }
                            }
                        }
                    ],
                },
            ];
        },
    },
})

export const youtubeAnalyzerTool = buildLlmTool({
    name: 'youtubeAnalyzer',
    description: 'Analyze a YouTube video by its URL and return a summary based on the instructions provided',
    inputSchema: z.object({
        url: z.url().describe('The URL of the YouTube video to analyze'),
        instructions: z.string().describe('The instructions for the YouTube analyzer'),
        startSeconds: z.number().optional().describe('The start time of the video to analyze in seconds'),
        endSeconds: z.number().optional().describe('The end time of the video to analyze in seconds'),
    }),
    
    config: {
        modelId: 'google/gemini-3.1-flash-lite-preview',
        modelConfig: {
            maxOutputTokens: 2000,
            reasoningEffort: 'low'
        },
        buildInput: (data) => {
            const startOffset = data.startSeconds ?? 0;
            const endOffset = Math.min(data.endSeconds || MAX_DURATION, startOffset + MAX_DURATION);
            return [
                {
                    role: 'system',
                    content: ''
                },
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: data.instructions
                        },
                        {
                            type: 'file',
                            data: data.url,
                            mediaType: 'video/mp4',
                            providerOptions: {
                                google: {
                                    videoMetadata: {
                                        fps: 1,
                                        startOffset: `${startOffset}s`,
                                        endOffset: `${endOffset}s`,
                                    }
                                }
                            }
                        }
                    ],
                },
            ];
        },
    },
})

// pdf