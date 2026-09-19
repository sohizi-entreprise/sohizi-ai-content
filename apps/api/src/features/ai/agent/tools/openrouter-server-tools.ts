import type { Tool, ToolSet } from "ai"
import { z } from "zod"

export const OPENROUTER_SERVER_TOOL_NAMES = ["web_search", "web_fetch"] as const

export type OpenRouterServerToolName =
  (typeof OPENROUTER_SERVER_TOOL_NAMES)[number]

const webSearchInputSchema = z.object({
  query: z.string().describe("The search query.").optional(),
})

const webFetchInputSchema = z.object({
  url: z.string().describe("The URL to fetch and extract text from."),
})

/**
 * OpenRouter executes these inside the chat completion. They must not go
 * through `getTool()` / the local agent tool loop.
 */
export function isOpenRouterServerTool(toolName: string): boolean {
  const normalized = toolName.replace(/[:.]/g, "_").toLowerCase()
  return (
    normalized === "web_search" ||
    normalized === "web_fetch" ||
    normalized === "openrouter_web_search" ||
    normalized === "openrouter_web_fetch"
  )
}

/**
 * AI SDK 7 expects `type: "provider"`. OpenRouter's `tools.webSearch()` still
 * emits `type: "provider-defined"`, which `prepareTools` rejects.
 */
function asProviderExecutedTool(tool: {
  id: `${string}.${string}`
  args?: Record<string, unknown>
  inputSchema: z.ZodType
}): Tool {
  return {
    type: "provider",
    id: tool.id,
    args: tool.args ?? {},
    inputSchema: tool.inputSchema,
    isProviderExecuted: true,
  }
}

export function getOpenRouterServerTools(): ToolSet {
  return {
    web_search: asProviderExecutedTool({
      id: "openrouter.web_search",
      args: {
        engine: "auto",
        maxResults: 5,
      },
      inputSchema: webSearchInputSchema,
    }),
    web_fetch: asProviderExecutedTool({
      id: "openrouter.web_fetch",
      args: {
        engine: "auto",
        maxUses: 8,
        maxContentTokens: 50_000,
      },
      inputSchema: webFetchInputSchema,
    }),
  }
}
