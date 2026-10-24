import { apiGenericApiSchema } from "../api-generic-api-schema"
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
  executeSubmitGeneration,
  executeVideoAnalysis,
  executeWaitForJob,
  executeYoutubeAnalysis,
} from "./handlers"
import {
  apiMediaOperationsSchema,
  type ApiMediaOperationsRequest,
} from "./schema"

export const apiMediaOperationsTool = buildBaseTool({
  name: "mediaOperationsAPI",
  description: `API for analyzing media and submitting or monitoring media-generation jobs.`,
  inputSchema: apiGenericApiSchema,
  execute: async (input, options) => {
    const request = parseMediaOperationsRequest(input)
    if (!request) {
      return failure(`Unknown or invalid endpoint "${input.endpoint}"`)
    }
    return dispatchMediaOperationsRequest(request, options)
  },
})

function parseMediaOperationsRequest(
  input: unknown,
): ApiMediaOperationsRequest | null {
  for (const schema of apiMediaOperationsSchema) {
    const parsed = schema.safeParse(input)
    if (parsed.success) return parsed.data
  }
  return null
}

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
    case "/media/generate":
      return executeSubmitGeneration(request, options)
    case "/media/jobs/wait":
      return executeWaitForJob(request, options)
    case "/media/jobs/status":
      return executeGetJobStatus(request, options)
  }
}
