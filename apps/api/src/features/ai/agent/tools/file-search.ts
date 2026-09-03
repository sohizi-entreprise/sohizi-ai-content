import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { findCommandSchema, searchCommandSchema } from "./command-schema"
import { Session } from "../core/session"
import { formatKeywordChunkResults } from "@/features/file-system/utils"
import { failure, success } from "./utils"
import {
  searchFileNodesByFormat,
  searchFileNodesByName,
  searchProjectChunksByKeyword,
} from "@/features/file-system/repo"
import { FileNode } from "@/db/schema"

const toolSchema = z.discriminatedUnion("cmd", [
  findCommandSchema,
  searchCommandSchema,
])

export const searchFileTool = buildBaseTool({
  name: "searchFile",
  description:
    "Search the file system using keyword search or semantic search. Keyword search runs project-wide using web-style query syntax (quoted phrases, OR, negation). Semantic search uses vector embeddings for meaning-based retrieval within a file or directory — use when you know the concept but not the exact wording.",
  inputSchema: z.object({
    command: toolSchema,
  }),
  execute: async (cmd, { session }) => {
    const input = cmd.command
    switch (input.cmd) {
      case "search":
        return executeKeywordSearchCommand(input, session)
      case "find":
        return executeFindCommand(input, session)
      default:
        return failure(
          "Invalid command received. Valid commands are: search, find.",
        )
    }
  },
})

async function executeKeywordSearchCommand(
  input: z.infer<typeof searchCommandSchema>,
  session: Session,
) {
  const { keyword } = input
  const hits = await searchProjectChunksByKeyword(session.projectId, keyword)
  if (hits.length === 0) {
    return failure(`No matches found for "${keyword}" in the project`)
  }
  const output = formatKeywordChunkResults(hits)
  return success(output)
}

async function executeFindCommand(
  input: z.infer<typeof findCommandSchema>,
  session: Session,
) {
  const { name, format, limit } = input
  const { projectId } = session

  if (!name && !format) {
    return failure("Either name or format is required.")
  }

  let files: FileNode[] = []

  if (name) {
    files = await searchFileNodesByName(projectId, name, limit)
  }

  if (format) {
    files = await searchFileNodesByFormat(projectId, format, limit)
  }

  if (files.length === 0) {
    return success("Nothing matches your search criteria")
  }

  let output = `Total files: ${files.length}\n---\n`
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    output += `${i + 1}. (${file.directory ? "directory" : "file"}) ${file.name} ${file.format ? `[format: ${file.format}]` : ""}\n`
  }
  return success(output)
}
