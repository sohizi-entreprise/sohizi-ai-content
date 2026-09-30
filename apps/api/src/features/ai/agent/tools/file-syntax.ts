import { z } from "zod"
import { fileType, type FileType } from "@/features/file-system/constants"
import { buildBaseTool } from "./tool-definition"
import { skillMdSyntaxPrompt, storyboardMdSyntaxPrompt } from "../prompts"
import { failure, success } from "./utils"

/**
 * File kinds that need custom writing syntax.
 * Add an entry to expose that type through fileSyntaxTool.
 */
const fileSyntaxByType = {
  [fileType.STORYBOARD]: storyboardMdSyntaxPrompt,
  [fileType.SKILL]: skillMdSyntaxPrompt,
} as const satisfies Partial<Record<FileType, string>>

type SyntaxType = keyof typeof fileSyntaxByType

const syntaxTypes = Object.keys(fileSyntaxByType) as [
  SyntaxType,
  ...SyntaxType[],
]

function formatList(types: readonly string[]) {
  if (types.length <= 1) return types[0] ?? ""
  return `${types.slice(0, -1).join(", ")} or ${types[types.length - 1]}`
}

export const fileSyntaxTool = buildBaseTool({
  name: "fileSyntaxTool",
  description: `Returns the writing syntax for a file type that does not use plain markdown. Call this before editFile write or patch when the type is ${formatList(syntaxTypes)}. The result is syntax rules only; it does not edit the file.`,
  inputSchema: z.object({
    fileType: z
      .enum(syntaxTypes)
      .describe(
        `File type whose syntax you need. One of: ${syntaxTypes.join(", ")}.`,
      ),
  }),
  execute: async ({ fileType: type }) => {
    const syntax = fileSyntaxByType[type]
    if (!syntax) {
      return failure(`No custom syntax is registered for "${type}".`)
    }
    return success(syntax)
  },
})
