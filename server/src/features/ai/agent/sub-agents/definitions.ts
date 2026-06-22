import { ToolSet } from "ai";
import { timelineExploreTool } from "../tools/timeline-explore";
import { getSchemas } from "../tools/tool-registry";
import { generateVideoTool } from "../tools/generate-video";
import { generateImageTool } from "../tools/generate-image";
import { exploreFileTool } from "../tools/file-explore";
import { searchFileTool } from "../tools/file-search";
import { ModelConfig } from "../utils/llm-client";


export type SubAgentDefinition = {
    name: string;
    description: string;
    systemPrompt: string;
    modelConfig: ModelConfig;
    modelId: string;
}

export const subAgentDefinitions: SubAgentDefinition[] = [
    {
        name: 'video-explorer',
        description: 'Explore a video timeline.',
        systemPrompt: '',
        modelConfig: {
            tools: getSchemas([timelineExploreTool]),
        },
        modelId: 'gpt-4o-mini'
    },
    {
        name: 'media-generator',
        description: 'Generate media based on the prompt.',
        modelConfig: {
            tools: getSchemas([generateImageTool, generateVideoTool]),
        },
        modelId: 'gpt-4o-mini',
        systemPrompt: ''
    },
    {
        name: 'html-video-generator',
        description: 'Generate HTML video based on the prompt.',
        modelConfig: {
            tools: getSchemas([]),
        },
        modelId: 'gpt-4o-mini',
        systemPrompt: ''
    },
    {
        name: 'explorer',
        description: 'Explore the file system and get information about the files and directories.',
        modelConfig: {
            tools: getSchemas([exploreFileTool, searchFileTool]),
        },
        modelId: 'gpt-4o-mini',
        systemPrompt: ''
    }
]