import { BaseTool } from "./tool-definition"
import { z } from "zod"
import { manageTodoListTool } from "./tasks-manage"
import { exploreFileTool } from "./file-explore"
import { searchFileTool } from "./file-search"
import { generateImageTool } from "./generate-image"
import { timelineExploreTool } from "./timeline-explore"
import { timelineEditTool } from "./timeline-edit"
import { editFileTool } from "./file-edit"
import { processSpeechTool } from "./process-speech"
import { endExecutionLoopTool, finishTool } from "./loop-end"
import { provideStatusUpdateTool } from "./progress-update"
import {
  listModelsTool,
  getModelSchemaTool,
  cancelRequestTool,
  submitRequestTool,
} from "./submit-media-jobs"
import { submitHtmlCompositionTool } from "./submit-html-composition"
import { loadSkillTool } from "./load-skill"
import { assignTaskTool } from "./tasks-assign"
import {
  imageAnalyzerTool,
  videoAnalyzerTool,
  youtubeAnalyzerTool,
} from "./media-analyzer"

const toolRegistry = new Map<string, BaseTool<z.ZodType>>()

const registerTool = (tool: BaseTool<z.ZodType>): void => {
  toolRegistry.set(tool.params.name, tool)
}

export const getTool = (name: string): BaseTool<z.ZodType> | undefined => {
  return toolRegistry.get(name)
}

export const allTools = {
  endExecutionLoopTool,
  editFileTool,
  exploreFileTool,
  searchFileTool,
  manageTodoListTool,
  generateImageTool,
  finishTool,
  timelineExploreTool,
  timelineEditTool,
  processSpeechTool,
  listModelsTool,
  getModelSchemaTool,
  submitRequestTool,
  cancelRequestTool,
  submitHtmlCompositionTool,
  loadSkillTool,
  assignTaskTool,
  provideStatusUpdateTool,
  imageAnalyzerTool,
  videoAnalyzerTool,
  youtubeAnalyzerTool,
} as const

for (const tool of Object.values(allTools)) {
  registerTool(tool)
}
