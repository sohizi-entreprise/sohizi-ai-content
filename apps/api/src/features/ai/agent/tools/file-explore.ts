import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import {
  listCommandSchema,
  existsCommandSchema,
  readCommandSchema,
  describeCommandSchema,
} from "./command-schema"
import { failure, success } from "./utils"
import { FileContentPayload } from "@/features/file-system/objects/file"
import { Session } from "../core/session"
import { SYSTEM_LEVEL_FILES } from "../constants/system-files"

const toolSchema = z.discriminatedUnion("cmd", [
  listCommandSchema,
  existsCommandSchema,
  readCommandSchema,
  describeCommandSchema,
])

export const exploreFileTool = buildBaseTool({
  name: "exploreFile",
  description:
    "Explore the file system and get information about the files and directories.",
  inputSchema: z.object({
    command: toolSchema,
  }),
  execute: async (cmd, { session }) => {
    const input = cmd.command
    switch (input.cmd) {
      case "list":
        return executeListCommand(input, session)
      case "exists":
        return executeExistsCommand(input, session)
      case "read":
        return executeReadCommand(input, session)
      case "describe":
        return executeDescribeCommand(input, session)
      default:
        return failure(
          "Invalid command received. Valid commands are: list, exists, read, describe.",
        )
    }
  },
})

async function executeListCommand(
  input: z.infer<typeof listCommandSchema>,
  session: Session,
) {
  const { isSystemFile } = maybeReadSystemFile(input.filePathOrId)
  if (isSystemFile) {
    return failure(`The list command does not support system files.`)
  }
  const fileObject = await session.resolveFileByPathOrId(input.filePathOrId)
  if (!fileObject) {
    return failure(`File ${input.filePathOrId} not found`)
  }

  const response = await fileObject.getDirectChildren()
  if (!response.ok || response.data === null) {
    return failure(
      response.error ?? `Failed to list directory ${input.filePathOrId}`,
    )
  }
  const children = response.data
  let output = `Total files: ${children.length}\n---\n`
  for (let i = 0; i < children.length; i++) {
    const file = children[i]
    let line = `${i + 1}. [${file.name}](${file.path}) - (${file.isDirectory ? "directory" : "file"}) ${file.type ? `- [type: ${file.type}, format: ${file.format ?? "unknown"}]` : ""}`
    if (file.isSkillFile) {
      const status = file.metadata?.status as string
      const msg =
        status.toLowerCase() === "draft"
          ? "Draft (!! DO NOT USE THIS SKILL YET !!)"
          : status
      line += ` - Status: ${msg}`
    }
    output += line + "\n"
  }
  return success(output)
}

async function executeExistsCommand(
  input: z.infer<typeof existsCommandSchema>,
  session: Session,
) {
  const { isSystemFile, content: sfContent } = maybeReadSystemFile(
    input.filePath,
  )
  if (isSystemFile) {
    if (!sfContent) {
      return failure(`System file path "${input.filePath}" does not exist`)
    }
    return success(`System file path "${input.filePath}" exists`)
  }
  const fileObject = await session.resolveFileByPathOrId(input.filePath)
  if (!fileObject) {
    return failure(`Path "${input.filePath}" is not found`)
  }
  return success(
    `${input.filePath} exists. It's a ${fileObject.isDirectory ? "directory" : "file"}. The ID is ${fileObject.id}.`,
  )
}

async function executeReadCommand(
  input: z.infer<typeof readCommandSchema>,
  session: Session,
) {
  // check if we are trying to read a system-level file
  const { isSystemFile, content: sfContent } = maybeReadSystemFile(
    input.filePathOrId,
  )
  if (isSystemFile) {
    if (!sfContent) {
      return failure(`System file ${input.filePathOrId} not found`)
    }
    return success(sfContent)
  }
  const fileObject = await session.resolveFileByPathOrId(input.filePathOrId)
  if (!fileObject) {
    return failure(`File ${input.filePathOrId} not found`)
  }

  if (fileObject.isDirectory) {
    return failure(
      `You cannot read the content of a directory. Use the list command instead.`,
    )
  }
  if (fileObject.type === null) {
    return failure(
      `The file you're trying to read might be corrupted due to its invalid type.`,
    )
  }

  const content = await fileObject.getFileContent()
  if (!content.ok || content.data === null) {
    return failure(content.error || "Failed to get the content of the file.")
  }

  const data = content.data

  return success(formatFileContent(data))
}

async function executeDescribeCommand(
  input: z.infer<typeof describeCommandSchema>,
  session: Session,
) {
  const fileObject = await session.resolveFileByPathOrId(input.filePathOrId)
  if (!fileObject) {
    return failure(`File ${input.filePathOrId} not found`)
  }
  const response = await fileObject.describe()
  return success(JSON.stringify(response.data, null, 2))
}

function formatFileContent(data: FileContentPayload): string {
  switch (data.type) {
    case "markdown":
      return data.data
    case "json":
      return JSON.stringify(data.data, null, 2)
    default:
      return `File of type: ${data.type} is not supported by this tool.`
  }
}

function maybeReadSystemFile(filePathOrId: string): {
  isSystemFile: boolean
  content: string | null
} {
  const result: { isSystemFile: boolean; content: string | null } = {
    isSystemFile: false,
    content: null,
  }
  if (filePathOrId.startsWith("/system/")) {
    result.isSystemFile = true
    const systemFile = SYSTEM_LEVEL_FILES[filePathOrId]
    if (!systemFile) {
      return result
    }
    result.content = systemFile.content
  }
  return result
}
