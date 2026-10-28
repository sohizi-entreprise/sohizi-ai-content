import {
  buildBaseTool,
  type ToolExecutionOptions,
  type ToolResult,
} from "../tool-definition"
import { failure } from "../utils"
import { apiFileSystemSchema, type ApiFileSystemRequest } from "./schema"
import {
  executeCopyFile,
  executeCreateFile,
  executeDeleteFile,
  executeDescribeFile,
  executeFileExists,
  executeFileSyntax,
  executeFindFiles,
  executeListFiles,
  executeMoveFile,
  executePatchFile,
  executeReadFile,
  executeRenameFile,
  executeSearchFiles,
  executeWriteFile,
} from "./handlers"
import {
  apiGenericApiSchema,
  parseApiToolRequest,
} from "../api-generic-api-schema"

export const apiFileSystemTool = buildBaseTool({
  name: "fileSystemAPI",
  description:
    "API for interacting with the files in the project. Refer to its documentation for the available endpoints and methods.",
  inputSchema: apiGenericApiSchema,
  execute: async (input, options) => {
    const parsed = parseApiToolRequest(input, apiFileSystemSchema)
    if (!parsed.ok) {
      return failure(parsed.error)
    }
    return dispatchFileSystemRequest(parsed.data, options)
  },
})

function dispatchFileSystemRequest(
  request: ApiFileSystemRequest,
  options: ToolExecutionOptions,
): Promise<ToolResult> {
  switch (request.endpoint) {
    case "/files/list":
      return executeListFiles(request, options)
    case "/files/exists":
      return executeFileExists(request, options)
    case "/files/read":
      return executeReadFile(request, options)
    case "/files/describe":
      return executeDescribeFile(request, options)
    case "/files/find":
      return executeFindFiles(request, options)
    case "/files/search":
      return executeSearchFiles(request, options)
    case "/files/syntax":
      return executeFileSyntax(request, options)
    case "/files/create":
      return executeCreateFile(request, options)
    case "/files/write":
      return executeWriteFile(request, options)
    case "/files/patch":
      return executePatchFile(request, options)
    case "/files/delete":
      return executeDeleteFile(request, options)
    case "/files/move":
      return executeMoveFile(request, options)
    case "/files/copy":
      return executeCopyFile(request, options)
    case "/files/rename":
      return executeRenameFile(request, options)
  }
}
