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
  executeAddClip,
  executeAddTrack,
  executeAtFrame,
  executeBatch,
  executeGenerateCaptions,
  executeListClips,
  executeOverview,
  executeRemoveClip,
  executeRemoveTrack,
  executeRippleShift,
  executeSplitClip,
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
    const parsed = parseApiToolRequest(input, apiVideoEditorSchema)
    if (!parsed.ok) {
      return failure(parsed.error)
    }
    return dispatchVideoEditorRequest(parsed.data, options)
  },
})

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
    case "/video-editor/clips/split":
      return executeSplitClip(request, options)
    case "/video-editor/clips/ripple-shift":
      return executeRippleShift(request, options)
    case "/video-editor/captions/generate":
      return executeGenerateCaptions(request, options)
    case "/video-editor/batch":
      return executeBatch(request, options)
  }
}
