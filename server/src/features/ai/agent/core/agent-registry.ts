import { ToolSet } from "ai";
import { mediaGeneratorPrompt } from "../prompts/media-generator";
import { editFileTool } from "../tools/file-edit";
import { exploreFileTool } from "../tools/file-explore";
import { searchFileTool } from "../tools/file-search";
import { submitMediaJobsTool } from "../tools/submit-media-jobs";
import { submitHtmlCompositionTool } from "../tools/submit-html-composition";
import { manageTodoListTool } from "../tools/tasks-manage";
import { timelineEditTool } from "../tools/timeline-edit";
import { timelineExploreTool } from "../tools/timeline-explore";
import { ModelConfig } from "../utils/llm-client";
import { generateSystemPrompt } from "./sys-prompt";
import { BaseTool } from "../tools/tool-definition";
import { z } from "zod";
import { htmlVideoGeneratorPrompt } from "../prompts/html-video-generator";
import { youtubeAnalyzerTool, videoAnalyzerTool, imageAnalyzerTool } from "../tools/media-analyzer";
import { generateImageTool } from "../tools/generate-image";
import { loadSkillTool } from "../tools/load-skill";

export const supportedAgents = [
    'media-generator', 
    'main-agent', 
    'explorer', 
    'researcher', 
    'motion-graphic'
] as const;

type AgentName = typeof supportedAgents[number];

export type AgentDefinition = {
    name: AgentName;
    description: string;
    baseSystemPrompt: string;
    modelConfig: ModelConfig;
    modelId: string;
    maxContextTokens: number;      // model context window used for consumption % computation
    contextThreshold?: number;     // 0-1, defaults to 0.8 in the ContextManager
    summaryModelId: string;        // dedicated summarizer model
    subAgents: AgentName[];
}

const getSchemas = (tools: BaseTool<z.ZodSchema>[]): ToolSet => {
    const result: ToolSet = {};
    for(const tool of tools){
        result[tool.params.name] = tool.schema;
    }
    return result;
}

const agentRegistry = new Map<string, AgentDefinition>();

export const getAgentDefinition = (name: AgentName): AgentDefinition | undefined => {
    return agentRegistry.get(name);
}

const registerAgent = (definition: AgentDefinition): void => {
    agentRegistry.set(definition.name, definition);
}

registerAgent({
    name: 'main-agent',
    description: 'The main agent for the application.',
    baseSystemPrompt: generateSystemPrompt(),
    modelConfig: {
        tools: getSchemas([
            exploreFileTool,
            searchFileTool, 
            timelineExploreTool, 
            timelineEditTool,
            manageTodoListTool,
            youtubeAnalyzerTool,
            videoAnalyzerTool,
            imageAnalyzerTool,
            editFileTool,
            loadSkillTool,
            generateImageTool
        ]),
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        maxOutputTokens: 3000,
    },
    modelId: 'openai/gpt-5.1', // This will be overridden by the model passed to the agent
    maxContextTokens: 400_000,
    contextThreshold: 0.8,
    summaryModelId: 'openai/gpt-5-nano',
    subAgents: ['media-generator'],
});

registerAgent({
    name: 'media-generator',
    description: 'Generate media based on the prompt.',
    baseSystemPrompt: mediaGeneratorPrompt,
    modelConfig: {
        tools: getSchemas([submitMediaJobsTool, manageTodoListTool, exploreFileTool, searchFileTool]),
        reasoningEffort: 'low',
        reasoningSummary: 'auto',
    },
    modelId: 'openai/gpt-5.1',
    maxContextTokens: 400_000,
    contextThreshold: 0.8,
    summaryModelId: 'openai/gpt-5-nano',
    subAgents: [],
});

registerAgent({
    name: 'motion-graphic',
    description: 'Generate standalone HyperFrames HTML video compositions.',
    baseSystemPrompt: htmlVideoGeneratorPrompt,
    modelConfig: {
        tools: getSchemas([
            submitHtmlCompositionTool,
            exploreFileTool,
            searchFileTool,
        ]),
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        maxOutputTokens: 100_000,
    },
    modelId: 'openai/gpt-5.2',
    maxContextTokens: 400_000,
    contextThreshold: 0.8,
    summaryModelId: 'openai/gpt-5-nano',
    subAgents: [],
});