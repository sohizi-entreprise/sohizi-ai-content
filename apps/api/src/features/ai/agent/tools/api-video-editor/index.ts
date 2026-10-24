import { apiGenericApiSchema } from "../api-generic-api-schema"
import {
  buildBaseTool,
  type ToolExecutionOptions,
  type ToolResult,
} from "../tool-definition"
import { failure } from "../utils"
import {
  executeAddClip,
  executeAddTrack,
  executeAtFrame,
  executeListClips,
  executeOverview,
  executeRemoveClip,
  executeRemoveTrack,
  executeUpdateClip,
  executeUpdateComposition,
  executeUpdateTrack,
  executeViewClip,
  executeViewClipSchema,
  executeViewTrack,
} from "./handlers"
import { apiVideoEditorSchema, type ApiVideoEditorRequest } from "./schema"

export const apiVideoEditorTool = buildBaseTool({
  name: "videoEditorAPI",
  description: `API for exploring and editing a video timeline.`,
  inputSchema: apiGenericApiSchema,
  execute: async (input, options) => {
    const request = parseVideoEditorRequest(input)
    if (!request) {
      return failure(`Unknown or invalid endpoint "${input.endpoint}"`)
    }
    return dispatchVideoEditorRequest(request, options)
  },
})

function parseVideoEditorRequest(input: unknown): ApiVideoEditorRequest | null {
  for (const schema of apiVideoEditorSchema) {
    const parsed = schema.safeParse(input)
    if (parsed.success) return parsed.data
  }
  return null
}

function dispatchVideoEditorRequest(
  request: ApiVideoEditorRequest,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  switch (request.endpoint) {
    case "/video-editor/overview":
      return executeOverview(request, options)
    case "/video-editor/clips/list":
      return executeListClips(request, options)
    case "/video-editor/clips/view":
      return executeViewClip(request, options)
    case "/video-editor/frame":
      return executeAtFrame(request, options)
    case "/video-editor/tracks/view":
      return executeViewTrack(request, options)
    case "/video-editor/clips/schema":
      return executeViewClipSchema(request, options)
    case "/video-editor/composition":
      return executeUpdateComposition(request, options)
    case "/video-editor/tracks/add":
      return executeAddTrack(request, options)
    case "/video-editor/tracks/update":
      return executeUpdateTrack(request, options)
    case "/video-editor/tracks/remove":
      return executeRemoveTrack(request, options)
    case "/video-editor/clips/add":
      return executeAddClip(request, options)
    case "/video-editor/clips/update":
      return executeUpdateClip(request, options)
    case "/video-editor/clips/remove":
      return executeRemoveClip(request, options)
  }
}
