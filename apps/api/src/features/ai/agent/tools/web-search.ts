import { z } from "zod"
import { getErrorMessage } from "@/utils/get-error-message"
import { buildBaseTool } from "./tool-definition"
import { failure, success } from "./utils"
import { tavilyExtract, tavilySearch } from "@/lib/tavily-client"

export const webSearchTool = buildBaseTool({
  name: "webSearch",
  description:
    "Use to search the web for up-to-date information. Returns titles, URLs, and brief text snippets.",
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

export const webPageExtractTool = buildBaseTool({
  name: "webPageExtract",
  description:
    "Extracts full webpage content as clean Markdown from a provided URL. Use when search snippets lack sufficient detail or when given a direct link.",
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
