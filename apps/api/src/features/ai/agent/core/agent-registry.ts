import { ToolSet } from "ai"
import { mediaGeneratorPrompt } from "../prompts/media-generator"
import { ModelConfig } from "../utils/llm-client"
import { BaseTool } from "../tools/tool-definition"
import { z } from "zod"
import { htmlVideoGeneratorPrompt } from "../prompts/html-video-generator"
import { allTools } from "../tools/tool-registry"
import { DEFAULT_AGENT_VENDOR } from "./vendor"
import { supportedAgents } from "../constants"
import {
  explorerPrompt,
  webSearcherPrompt,
  mainAgentPrompt,
  fileSystemPrompt,
  navigateContextPrompt,
  progressUpdatePrompt,
} from "../prompts"
import { getOpenRouterServerTools } from "../tools/openrouter-server-tools"

export type AgentName = (typeof supportedAgents)[number]

export type AgentDefinition = {
  name: AgentName
  description: string
  baseSystemPrompt: string
  modelConfig: ModelConfig
  modelId: string
  vendor: string
  contextThreshold?: number // 0-1, defaults to 0.8 in the ContextManager
  summaryModelId: string // dedicated summarizer model
  subAgents: AgentName[]
}

const getSchemas = (tools: BaseTool<z.ZodType>[]): ToolSet => {
  const result: ToolSet = {}
  for (const tool of tools) {
    result[tool.params.name] = tool.schema
  }
  return result
}

const agentRegistry = new Map<string, AgentDefinition>()

export const getAgentDefinition = (
  name: AgentName,
): AgentDefinition | undefined => {
  return agentRegistry.get(name)
}

const registerAgent = (definition: AgentDefinition): void => {
  agentRegistry.set(definition.name, definition)
}

registerAgent({
  name: "main-agent",
  description: "The main agent for the application.",
  baseSystemPrompt:
    mainAgentPrompt +
    "\n\n" +
    fileSystemPrompt +
    "\n\n" +
    navigateContextPrompt +
    "\n\n" +
    progressUpdatePrompt,
  modelConfig: {
    tools: getSchemas([
      allTools.exploreFileTool,
      allTools.searchFileTool,
      // allTools.timelineExploreTool,
      // allTools.timelineEditTool,
      allTools.manageTodoListTool,
      allTools.youtubeAnalyzerTool,
      allTools.videoAnalyzerTool,
      allTools.imageAnalyzerTool,
      allTools.editFileTool,
      allTools.assignTaskTool,
      allTools.loadSkillTool,
      allTools.listModelsTool,
      allTools.getModelSchemaTool,
      allTools.submitAssetGenerationJob,
      allTools.waitForJob,
      allTools.getJobStatus,
      allTools.provideStatusUpdateTool,
      allTools.fileSyntaxTool,
    ]),
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    maxOutputTokens: 3000,
  },
  modelId: "openai/gpt-5.1", // This will be overridden by the model passed to the agent
  vendor: DEFAULT_AGENT_VENDOR,
  contextThreshold: 0.8,
  summaryModelId: "openai/gpt-5-nano",
  subAgents: ["media-generator", "explorer", "web-searcher"],
})

registerAgent({
  name: "media-generator",
  description: "Generate media based on the prompt.",
  baseSystemPrompt: mediaGeneratorPrompt,
  modelConfig: {
    tools: getSchemas([
      allTools.manageTodoListTool,
      allTools.exploreFileTool,
      allTools.searchFileTool,
      allTools.youtubeAnalyzerTool,
      allTools.videoAnalyzerTool,
      allTools.imageAnalyzerTool,
      allTools.listModelsTool,
      allTools.getModelSchemaTool,
      allTools.cancelRequestTool,
      allTools.submitRequestTool,
    ]),
    reasoningEffort: "low",
    reasoningSummary: "auto",
  },
  modelId: "openai/gpt-5.2",
  vendor: DEFAULT_AGENT_VENDOR,
  contextThreshold: 0.8,
  summaryModelId: "openai/gpt-5-nano",
  subAgents: [],
})

registerAgent({
  name: "motion-graphic",
  description: "Generate standalone HyperFrames HTML video compositions.",
  baseSystemPrompt: htmlVideoGeneratorPrompt,
  modelConfig: {
    tools: getSchemas([
      allTools.submitHtmlCompositionTool,
      allTools.exploreFileTool,
      allTools.searchFileTool,
    ]),
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    maxOutputTokens: 100_000,
  },
  modelId: "openai/gpt-5.2",
  vendor: DEFAULT_AGENT_VENDOR,
  contextThreshold: 0.8,
  summaryModelId: "openai/gpt-5-nano",
  subAgents: [],
})

registerAgent({
  name: "explorer",
  description: "Explore the file system.",
  baseSystemPrompt:
    explorerPrompt + "\n\n" + fileSystemPrompt + "\n\n" + navigateContextPrompt,
  modelConfig: {
    tools: getSchemas([
      allTools.exploreFileTool,
      allTools.provideStatusUpdateTool,
    ]),
    reasoningEffort: "low",
    reasoningSummary: "auto",
    maxOutputTokens: 3000,
  },
  modelId: "openai/gpt-5.2",
  vendor: DEFAULT_AGENT_VENDOR,
  contextThreshold: 0.8,
  summaryModelId: "openai/gpt-5-nano",
  subAgents: [],
})

registerAgent({
  name: "web-searcher",
  description:
    "Search the live web and fetch public pages for current, cited information.",
  baseSystemPrompt: webSearcherPrompt,
  modelConfig: {
    tools: getOpenRouterServerTools(),
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    maxOutputTokens: 4000,
  },
  modelId: "openai/gpt-5.2",
  vendor: DEFAULT_AGENT_VENDOR,
  contextThreshold: 0.8,
  summaryModelId: "openai/gpt-5-nano",
  subAgents: [],
})
