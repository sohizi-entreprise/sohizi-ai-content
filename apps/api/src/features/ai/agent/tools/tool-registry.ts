import { BaseTool } from "./tool-definition"
import { z } from "zod"
import { manageTodoListTool } from "./tasks-manage"
import { provideStatusUpdateTool } from "./progress-update"
import { submitHtmlCompositionTool } from "./submit-html-composition"
import { assignTaskTool } from "./tasks-assign"
import { getArtifactTool } from "./get-artifact"
import { apiDocReadTool } from "./api-doc-read"
import { apiFileSystemTool } from "./api-file-system"
import { apiMediaOperationsTool } from "./api-media-operations"
import { apiVideoEditorTool } from "./api-video-editor"
import { apiWebTool } from "./api-web"
import { askQuestionsTool } from "./ask-questions"
import { recallMemoryTool, saveMemoryTool } from "./memory"

const toolRegistry = new Map<string, BaseTool<z.ZodType>>()

const registerTool = (tool: BaseTool<z.ZodType>): void => {
  toolRegistry.set(tool.params.name, tool)
}

export const getTool = (name: string): BaseTool<z.ZodType> | undefined => {
  return toolRegistry.get(name)
}

export const allTools = {
  manageTodoListTool,
  submitHtmlCompositionTool,
  assignTaskTool,
  provideStatusUpdateTool,
  askQuestionsTool,
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
