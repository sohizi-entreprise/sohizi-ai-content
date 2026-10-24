import buildDoc from "../api-build-doc"
import {
  buildBaseTool,
  type ToolExecutionOptions,
  type ToolResult,
} from "../tool-definition"
import { failure } from "../utils"
import { executeExtractWeb, executeSearchWeb } from "./handlers"
import { apiWebSchema, type ApiWebRequest } from "./schema"
import { apiGenericApiSchema } from "../api-generic-api-schema"

const documentation = apiWebSchema
  .map((schema) => buildDoc(schema))
  .join("\n\n")

export const apiWebTool = buildBaseTool({
  name: "webAPI",
  description: `API for searching the live web and extracting public pages.\n\n${documentation}`,
  inputSchema: apiGenericApiSchema,
  execute: async (input, options) => {
    const request = parseWebRequest(input)
    if (!request) {
      return failure(`Unknown or invalid endpoint "${input.endpoint}"`)
    }
    return dispatchWebRequest(request, options)
  },
})

function parseWebRequest(input: unknown): ApiWebRequest | null {
  for (const schema of apiWebSchema) {
    const parsed = schema.safeParse(input)
    if (parsed.success) return parsed.data
  }
  return null
}

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
