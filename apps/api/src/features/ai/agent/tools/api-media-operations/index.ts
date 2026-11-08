import {
  apiGenericApiSchema,
  parseApiToolRequest,
} from "../api-generic-api-schema"
import {
  buildBaseTool,
  type ToolExecutionOptions,
  type ToolResult,
} from "../tool-definition"
import { failure } from "../utils"
import {
  executeGetModelSchema,
  executeGetJobStatus,
  executeImageAnalysis,
  executeListModels,
  executeMediaTranscription,
  executeSaveAsset,
  executeSubmitGeneration,
  executeVideoAnalysis,
  executeWaitForJob,
  executeYoutubeAnalysis,
  executeYoutubeScreenshot,
} from "./handlers"
import {
  apiMediaOperationsSchema,
  type ApiMediaOperationsRequest,
} from "./schema"

export const apiMediaOperationsTool = buildBaseTool({
  name: "mediaOperationsAPI",
  description: `API for analyzing and transcribing media, capturing YouTube screenshots, and submitting or monitoring media-generation jobs.`,
  inputSchema: apiGenericApiSchema,
  execute: async (input, options) => {
    const parsed = parseApiToolRequest(input, apiMediaOperationsSchema)
    if (!parsed.ok) {
      return failure(parsed.error)
    }
    return dispatchMediaOperationsRequest(parsed.data, options)
  },
})

function dispatchMediaOperationsRequest(
  request: ApiMediaOperationsRequest,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  switch (request.endpoint) {
    case "/media/models":
      return executeListModels(request, options)
    case "/media/models/schema":
      return executeGetModelSchema(request, options)
    case "/media/analyze/image":
      return executeImageAnalysis(request, options)
    case "/media/analyze/video":
      return executeVideoAnalysis(request, options)
    case "/media/analyze/youtube":
      return executeYoutubeAnalysis(request, options)
    case "/media/extract-frame/youtube":
      return executeYoutubeScreenshot(request, options)
    case "/media/transcribe":
      return executeMediaTranscription(request, options)
    case "/media/assets/generate":
      return executeSubmitGeneration(request, options)
    case "/media/assets/save":
      return executeSaveAsset(request, options)
    case "/media/jobs/wait":
      return executeWaitForJob(request, options)
    case "/media/jobs/status":
      return executeGetJobStatus(request, options)
  }
}
