import { ToolSet } from "ai"
import { ModelConfig } from "../utils/llm-client"
import { BaseTool } from "../tools/tool-definition"
import { z } from "zod"
import { allTools } from "../tools/tool-registry"
import { supportedAgents } from "../constants"
import {
  explorerPrompt,
  webSearcherPrompt,
  mainAgentPrompt,
  fileSystemPrompt,
} from "../prompts"
import modelsTracker from "@/catalog/models-tracker"
import buildDoc from "../tools/api-build-doc"
import { apiFileSystemSchema } from "../tools/api-file-system/schema"

export type AgentName = (typeof supportedAgents)[number]

export type AgentDefinition = {
  name: AgentName
  description: string
  baseSystemPrompt: string
  modelConfig: ModelConfig
  modelId: string
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
    mainAgentPrompt + "\n\n" + fileSystemPrompt + "\n\n" + buildFileApiDoc(),
  modelConfig: {
    tools: getSchemas([
      allTools.manageTodoListTool,
      allTools.assignTaskTool,
      allTools.provideStatusUpdateTool,
      allTools.askQuestionsTool,
      allTools.getArtifactTool,
      allTools.apiDocReadTool,
      allTools.apiFileSystemTool,
      allTools.apiMediaOperationsTool,
      allTools.apiVideoEditorTool,
      allTools.apiWebTool,
      allTools.recallMemoryTool,
      allTools.saveMemoryTool,
    ]),
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    maxOutputTokens: 30000,
  },
  modelId: "", // This will be overridden by the model passed to the agent
  contextThreshold: 0.75,
  summaryModelId: "google/gemini-2.5-flash-lite",
  subAgents: ["explorer"],
})

registerAgent({
  name: "explorer",
  description: "Explore the file system.",
  baseSystemPrompt: explorerPrompt + "\n\n" + fileSystemPrompt,
  modelConfig: {
    tools: getSchemas([
      allTools.apiDocReadTool,
      allTools.apiFileSystemTool,
      allTools.provideStatusUpdateTool,
      allTools.getArtifactTool,
    ]),
    reasoningEffort: "low",
    reasoningSummary: "auto",
    maxOutputTokens: 3000,
  },
  modelId: modelsTracker.explorer,
  contextThreshold: 0.8,
  summaryModelId: modelsTracker.summarizer,
  subAgents: [],
})

registerAgent({
  name: "web-searcher",
  description:
    "Search the live web and fetch public pages for current, cited information.",
  baseSystemPrompt: webSearcherPrompt,
  modelConfig: {
    tools: getSchemas([
      allTools.apiDocReadTool,
      allTools.apiWebTool,
      allTools.getArtifactTool,
    ]),
    reasoningEffort: "medium",
    reasoningSummary: "auto",
    maxOutputTokens: 4000,
  },
  modelId: modelsTracker.webSearcher,
  contextThreshold: 0.8,
  summaryModelId: modelsTracker.summarizer,
  subAgents: [],
})

function buildFileApiDoc() {
  return `
<documentation api="fileSystemAPI">
  ${buildDoc(apiFileSystemSchema)}
</documentation>
  `
}
