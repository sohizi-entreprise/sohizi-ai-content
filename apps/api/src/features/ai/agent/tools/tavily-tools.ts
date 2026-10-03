import { z } from "zod"
import { getErrorMessage } from "@/utils/get-error-message"
import { buildBaseTool } from "./tool-definition"
import { failure, success } from "./utils"
import { tavilyExtract, tavilySearch } from "./tavily-client"

export const tavilySearchTool = buildBaseTool({
  name: "tavily-search",
  description:
    "Discover web sources and current information. Returns titles, URLs, and short snippets.",
  inputSchema: z.object({
    query: z.string().describe("The search query."),
    include_images: z
      .boolean()
      .optional()
      .describe("Include image URLs in the results."),
  }),
  execute: async (input, { abortSignal }) => {
    try {
      return success(await tavilySearch(input, abortSignal))
    } catch (error) {
      return failure(getErrorMessage(error))
    }
  },
})

export const tavilyExtractTool = buildBaseTool({
  name: "tavily-extract",
  description:
    "Extract clean markdown content from known URLs. Use after tavily-search when snippets are not enough.",
  inputSchema: z.object({
    urls: z
      .array(z.string())
      .min(1)
      .max(20)
      .describe("One to twenty URLs to extract."),
    query: z
      .string()
      .optional()
      .describe(
        "Optional intent used to rerank extracted chunks toward the most relevant passages.",
      ),
  }),
  execute: async (input, { abortSignal }) => {
    try {
      return success(await tavilyExtract(input, abortSignal))
    } catch (error) {
      return failure(getErrorMessage(error))
    }
  },
})
