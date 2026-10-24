import { billingService, withBilling, type Billable } from "@/features/billing"
import { classifyWebError } from "@/features/capacity/classify"
import { runWithCapacity } from "@/features/capacity/router"
import { tavilyExtract, tavilySearch } from "@/lib/tavily-client"
import { getErrorMessage } from "@/utils/get-error-message"
import type { ToolExecutionOptions, ToolResult } from "../tool-definition"
import { failure, success } from "../utils"
import type { ApiWebRequest } from "./schema"

/** $0.009 at the $0.003 wallet rate. Covers one Tavily basic search or a full extract. */
const WEB_TOOL_CREDITS = 3n
const WEB_TOOL_TIMEOUT_MS = 60_000

type BilledWebCall = {
  toolCallId: string
  run: (signal: AbortSignal) => Promise<string>
}

type RequestFor<Endpoint extends ApiWebRequest["endpoint"]> = Extract<
  ApiWebRequest,
  { endpoint: Endpoint }
>

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

export async function executeSearchWeb(
  data: RequestFor<"/web/search">,
  { abortSignal, session, toolCallId }: ToolExecutionOptions,
): Promise<ToolResult> {
  try {
    const output = await runWebSearch(
      {
        toolCallId,
        run: (signal) =>
          runWithCapacity({
            task: "web.search",
            holderId: toolCallId,
            leaseTtlMs: WEB_TOOL_TIMEOUT_MS,
            waitMs: WEB_TOOL_TIMEOUT_MS,
            signal,
            classify: classifyWebError,
            run: ({ account }) =>
              tavilySearch(account.credential, data.params, signal),
          }),
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
}

export async function executeExtractWeb(
  data: RequestFor<"/web/extract">,
  { abortSignal, session, toolCallId }: ToolExecutionOptions,
): Promise<ToolResult> {
  try {
    const output = await runWebPageExtract(
      {
        toolCallId,
        run: (signal) =>
          runWithCapacity({
            task: "web.extract",
            holderId: toolCallId,
            leaseTtlMs: WEB_TOOL_TIMEOUT_MS,
            waitMs: WEB_TOOL_TIMEOUT_MS,
            signal,
            classify: classifyWebError,
            run: ({ account }) =>
              tavilyExtract(account.credential, data.body, signal),
          }),
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
}
