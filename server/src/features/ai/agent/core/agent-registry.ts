import { mediaGeneratorPrompt } from "../prompts/media-generator";
import { exploreFileTool } from "../tools/file-explore";
import { searchFileTool } from "../tools/file-search";
import { submitMediaJobsTool } from "../tools/submit-media-jobs";
import { timelineExploreTool } from "../tools/timeline-explore";
import { getSchemas } from "../tools/tool-registry";
import { ModelConfig } from "../utils/llm-client";

type AgentName = 'media-generator' | 'main-agent';

export type AgentDefinition = {
    name: AgentName;
    description: string;
    baseSystemPrompt: string;
    modelConfig: ModelConfig;
    modelId: string;
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
    baseSystemPrompt: '',
    modelConfig: {
        tools: getSchemas([timelineExploreTool]),
    },
    modelId: 'gpt-4o-mini'
});

registerAgent({
    name: 'media-generator',
    description: 'Generate media based on the prompt.',
    baseSystemPrompt: mediaGeneratorPrompt,
    modelConfig: {
        tools: getSchemas([submitMediaJobsTool, exploreFileTool, searchFileTool]),
        reasoningEffort: 'minimal',
    },
    modelId: 'gpt-5.1'
});