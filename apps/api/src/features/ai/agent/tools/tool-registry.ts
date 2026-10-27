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
import { fileSyntaxTool } from "./file-syntax"
import {
  listModelsTool,
  getModelSchemaTool,
  submitRequestTool,
  cancelRequestTool,
} from "./submit-media-jobs"
import { submitHtmlCompositionTool } from "./submit-html-composition"
import { loadSkillTool } from "./load-skill"
import { assignTaskTool } from "./tasks-assign"
import {
  imageAnalyzerTool,
  videoAnalyzerTool,
  youtubeAnalyzerTool,
  mediaAnalyzerTool,
} from "./media-analyzer"
import { getJobStatus, submitAssetGenerationJob, waitForJob } from "./wait-job"
import { webPageExtractTool, webSearchTool } from "./web-search"
import { getArtifactTool } from "./get-artifact"
import { apiDocReadTool } from "./api-doc-read"
import { apiFileSystemTool } from "./api-file-system"
import { apiMediaOperationsTool } from "./api-media-operations"
import { apiVideoEditorTool } from "./api-video-editor"
import { apiWebTool } from "./api-web"
import { recallMemoryTool, saveMemoryTool } from "./memory"

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
  mediaAnalyzerTool,
  submitAssetGenerationJob,
  waitForJob,
  getJobStatus,
  fileSyntaxTool,
  webSearchTool,
  webPageExtractTool,
  getArtifactTool,
  apiDocReadTool,
  apiFileSystemTool,
  apiMediaOperationsTool,
  apiVideoEditorTool,
  apiWebTool,
  recallMemoryTool,
  saveMemoryTool,
} as const

for (const tool of Object.values(allTools)) {
  registerTool(tool)
}
