import { ToolSet } from "ai";
import { mediaGeneratorPrompt } from "../prompts/media-generator";
import { editFileTool } from "../tools/file-edit";
import { exploreFileTool } from "../tools/file-explore";
import { searchFileTool } from "../tools/file-search";
import { endExecutionLoopTool, finishTool } from "../tools/loop-end";
import { submitMediaJobsTool } from "../tools/submit-media-jobs";
import { manageTodoListTool } from "../tools/tasks-manage";
import { timelineEditTool } from "../tools/timeline-edit";
import { timelineExploreTool } from "../tools/timeline-explore";
import { ModelConfig } from "../utils/llm-client";
import { generateSystemPrompt } from "./sys-prompt";
import { BaseTool } from "../tools/tool-definition";
import { z } from "zod";

type AgentName = 'media-generator' | 'main-agent';

export type AgentDefinition = {
    name: AgentName;
    description: string;
    baseSystemPrompt: string;
    modelConfig: ModelConfig;
    modelId: string;
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
            finishTool,
            manageTodoListTool,
            editFileTool
        ]),
        reasoningEffort: 'medium',
        reasoningSummary: 'auto',
        maxOutputTokens: 3000,
    },
    modelId: 'openai/gpt-5.1' // This will be overridden by the model passed to the agent
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
    modelId: 'openai/gpt-5.1'
});