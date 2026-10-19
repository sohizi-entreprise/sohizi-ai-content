import { z } from "zod"
import { getErrorMessage } from "@/utils/get-error-message"
import { billingService, withBilling, type Billable } from "@/features/billing"
import { buildBaseTool } from "./tool-definition"
import { failure, success } from "./utils"
import { tavilyExtract, tavilySearch } from "@/lib/tavily-client"

/** $0.009 at the $0.003 wallet rate. Covers one Tavily basic search or a full extract. */
const WEB_TOOL_CREDITS = 3n
const WEB_TOOL_TIMEOUT_MS = 60_000

type BilledWebCall = {
  toolCallId: string
  run: (signal: AbortSignal) => Promise<string>
}

function createWebToolBillable(
  operation: string,
): Billable<BilledWebCall, string> {
  return {
    operation,
    timeoutMs: WEB_TOOL_TIMEOUT_MS,
    estimateCost: () => WEB_TOOL_CREDITS,
    async execute(input, ctx) {
      const output = await input.run(ctx.signal)
      return { output, actualCredits: WEB_TOOL_CREDITS }
    },
    idempotencyKey: (input) => `${operation}:${input.toolCallId}`,
  }
}

const runWebSearch = withBilling(
  createWebToolBillable("web-search"),
  billingService,
)
const runWebPageExtract = withBilling(
  createWebToolBillable("web-page-extract"),
  billingService,
)

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
  execute: async (input, { abortSignal, session, toolCallId }) => {
    try {
      const output = await runWebSearch(
        {
          toolCallId,
          run: (signal) => tavilySearch(input, signal),
        },
        {
          organizationId: session.organizationId,
          userId: session.userId,
          signal: abortSignal,
        },
      )
      return success(output)
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
  execute: async (input, { abortSignal, session, toolCallId }) => {
    try {
      const output = await runWebPageExtract(
        {
          toolCallId,
          run: (signal) => tavilyExtract(input, signal),
        },
        {
          organizationId: session.organizationId,
          userId: session.userId,
          signal: abortSignal,
        },
      )
      return success(output)
    } catch (error) {
      return failure(getErrorMessage(error))
    }
  },
})
