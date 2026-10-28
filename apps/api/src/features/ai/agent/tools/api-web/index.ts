import {
  buildBaseTool,
  type ToolExecutionOptions,
  type ToolResult,
} from "../tool-definition"
import { failure } from "../utils"
import { executeExtractWeb, executeSearchWeb } from "./handlers"
import { apiWebSchema, type ApiWebRequest } from "./schema"
import {
  apiGenericApiSchema,
  parseApiToolRequest,
} from "../api-generic-api-schema"

export const apiWebTool = buildBaseTool({
  name: "webAPI",
  description: `API for searching the live web and extracting public pages.`,
  inputSchema: apiGenericApiSchema,
  execute: async (input, options) => {
    const parsed = parseApiToolRequest(input, apiWebSchema)
    if (!parsed.ok) {
      return failure(parsed.error)
    }
    return dispatchWebRequest(parsed.data, options)
  },
})

function dispatchWebRequest(
  request: ApiWebRequest,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  switch (request.endpoint) {
    case "/web/search":
      return executeSearchWeb(request, options)
    case "/web/extract":
      return executeExtractWeb(request, options)
  }
}
