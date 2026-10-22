import { ModelMessage } from "ai"
import type { ContextArtifactMetadata } from "@/db/schema"
import { billingService, withBillingStream } from "@/features/billing"
import { BillableLlmInput, createBillableLlmClient } from "../utils/llm-client"
import { LlmChunk, streamEvents } from "../utils/llm-response"
import { estimateInputTokens } from "../utils/estimate-token"
import { TokenUsage } from "@/type"
import { Session } from "./session"
import { AgentStateManager } from "./state-manager"
import { extractTextFromContent } from "../utils/message-content"
import { contextSummaryMessage } from "./system-persist"
import { selectCompressionWindow, splitRetainedRuns } from "./context-window"
import { truncatedToolResult } from "./context-artifact-format"

export type ContextArtifactStore = {
  save(
    rows: Array<{ metadata: ContextArtifactMetadata; data: unknown }>,
  ): Promise<string[]>
}

export type ContextManagerConfig = {
  maxContextTokens: number
  session: Session
  summaryModelId: string
  threshold?: number
  pruneMaxLength?: number
  artifactStore?: ContextArtifactStore
}

export type ConsumptionInfo = {
  tokens: number
  max: number
  percentage: number
  exceeded: boolean
}

type SummarizeInput = {
  systemPrompt: string
  transcript: string
}

type SummarizeFn = (input: SummarizeInput) => Promise<string>

type BilledLlmStream = ReturnType<
  typeof withBillingStream<BillableLlmInput, LlmChunk>
>

const DEFAULT_THRESHOLD = 0.8
const DEFAULT_PRUNE_MAX_LENGTH = 200
const DEFAULT_SUMMARY_OUTPUT_TOKENS = 2048

const TRUNCATION_MARKER = "...[CONCANATED]"

const SUMMARY_SYSTEM_PROMPT = `You are a conversation summarizer for an autonomous AI agent operating in a tool-calling loop.

You are given the older portion of a conversation. The recent turns are kept separately and are not in this transcript. Produce a single, clear summary that lets the agent continue its work without losing the original goal.

## Requirements
- Preserve the original user goal and how the task evolved (decisions made, what was tried, what worked or failed).
- Keep ALL concrete facts EXACTLY as written: file ids, file paths, URLs, asset ids, todo ids, tool names, and any other identifiers. Never paraphrase or invent identifiers.
- Be concise but complete: capture the important state, not every keystroke.
- This older history is not stored anywhere else. Do not refer to artifacts or claim that omitted details can be retrieved.
- Do not add commentary about the summarization itself.

Return only the summary text.`

export class ContextManager {
  private readonly maxContextTokens: number
  private readonly threshold: number
  private readonly pruneMaxLength: number
  private readonly session: Session
  private readonly summaryModelId: string
  private readonly artifactStore: ContextArtifactStore | undefined
  private summaryStream: BilledLlmStream | null | undefined

  constructor(config: ContextManagerConfig) {
    this.maxContextTokens = config.maxContextTokens
    this.session = config.session
    this.summaryModelId = config.summaryModelId
    this.threshold = config.threshold ?? DEFAULT_THRESHOLD
    this.pruneMaxLength = config.pruneMaxLength ?? DEFAULT_PRUNE_MAX_LENGTH
    this.artifactStore = config.artifactStore
    this.summaryStream = undefined
  }

  /** Compress before a call or after a metered step reaches the threshold. */
  async maybeCompress(
    stateManager: AgentStateManager,
    inputTokens: number,
    abortSignal: AbortSignal,
    runId: string,
  ): Promise<void> {
    if (
      abortSignal.aborted ||
      stateManager.status === "error" ||
      stateManager.status === "paused"
    ) {
      return
    }

    const consumption = this.getConsumption(inputTokens)
    // console.log(`[context] ${consumption.tokens}/${consumption.max} tokens (${(consumption.percentage * 100).toFixed(1)}%)`);
    if (!consumption.exceeded) {
      return
    }

    const messages = stateManager.getState().messages
    const summaryStream = await this.getSummaryStream()

    // Fall back to pruning-only when a dedicated summary model is unavailable.
    let compressed: ModelMessage[]
    try {
      compressed = summaryStream
        ? await this.compress(
            messages,
            this.buildSummarizeFn(
              stateManager,
              summaryStream,
              abortSignal,
              runId,
            ),
            stateManager.isRunning,
          )
        : this.pruneMessages(messages)
    } catch (error) {
      console.error("Failed to compress context", error)
      return
    }

    if (compressed !== messages) {
      stateManager.replaceMessages(compressed)
    }
  }

  getConsumption(inputTokens: number): ConsumptionInfo {
    const max = this.maxContextTokens > 0 ? this.maxContextTokens : 1
    const percentage = inputTokens / max
    return {
      tokens: inputTokens,
      max: this.maxContextTokens,
      percentage,
      exceeded: percentage >= this.threshold,
    }
  }

  /**
   * Strategy 1 — Message pruning.
   * Truncate long tool result payloads to `pruneMaxLength` characters and
   * append a marker so the model knows the content was shortened.
   */
  pruneMessages(messages: ModelMessage[]): ModelMessage[] {
    const pruned = messages.map((message) => {
      if (message.role !== "tool" || !Array.isArray(message.content)) {
        return message
      }

      const originalContent = message.content
      const content = originalContent.map((part) => {
        if (part.type !== "tool-result") {
          return part
        }
        const output = part.output
        if (
          (output.type === "text" || output.type === "error-text") &&
          typeof output.value === "string" &&
          output.value.length > this.pruneMaxLength
        ) {
          return {
            ...part,
            output: {
              ...output,
              value:
                output.value.slice(0, this.pruneMaxLength) + TRUNCATION_MARKER,
            },
          }
        }
        return part
      })

      return content.every((part, index) => part === originalContent[index])
        ? message
        : { ...message, content }
    })
    return pruned.every((message, index) => message === messages[index])
      ? messages
      : pruned
  }

  /**
   * Keep the main system prompt and the latest five real user turns.
   * Older history is summarized. Tool results in the four older retained
   * turns are replaced with previews that point at stored artifacts.
   */
  async compress(
    messages: ModelMessage[],
    summarizeFn: SummarizeFn,
    resume = true,
  ): Promise<ModelMessage[]> {
    const { mainSystem, older, retained } = selectCompressionWindow(messages)
    const { earlier, latest } = splitRetainedRuns(retained)
    let summaryMessage: ModelMessage | null = null
    if (older.length > 0) {
      const summary = await summarizeFn({
        systemPrompt: SUMMARY_SYSTEM_PROMPT,
        transcript: this.buildTranscript(older),
      })
      if (!summary.trim()) return messages
      summaryMessage = contextSummaryMessage(summary)
    }

    const jobs = collectToolResultJobs(earlier)
    const artifactized =
      jobs.length > 0 ? await this.artifactize(earlier, jobs) : earlier

    const assembled = [
      ...mainSystem,
      ...(summaryMessage ? [summaryMessage] : []),
      ...artifactized,
      ...latest,
    ]
    if (
      !summaryMessage &&
      artifactized === earlier &&
      sameMessages(assembled, messages)
    ) {
      return messages
    }
    if (!resume || (!summaryMessage && artifactized === earlier)) {
      return assembled
    }

    const explain: ModelMessage = {
      role: "user",
      content: [
        {
          type: "text",
          text: "The earlier messages in this conversation have been summarized to save context.",
        },
      ],
      providerOptions: { sohizi: { kind: "context-note" } },
    }
    const acknowledge: ModelMessage = {
      role: "assistant",
      content: [
        {
          type: "text",
          text: "Acknowledged — I have the summarized context and the retained messages.",
        },
      ],
    }
    const cont: ModelMessage = {
      role: "user",
      content: [{ type: "text", text: "Please continue with the task." }],
      providerOptions: { sohizi: { kind: "context-continuation" } },
    }
    return [...assembled, explain, acknowledge, cont]
  }

  private async artifactize(
    messages: ModelMessage[],
    jobs: ToolResultJob[],
  ): Promise<ModelMessage[]> {
    const ids = await this.saveArtifacts(
      jobs.map((job) => ({
        metadata: {
          projectId: this.session.projectId,
          conversationId: this.session.conversationId ?? null,
          sessionId: this.session.id,
          toolName: job.toolName,
          toolCallId: job.toolCallId,
        },
        data: { output: job.output },
      })),
    )
    if (ids.length !== jobs.length) {
      throw new Error("Artifact storage did not return an id for every tool result")
    }
    return applyToolResultArtifacts(messages, jobs, ids)
  }

  private async saveArtifacts(
    rows: Array<{ metadata: ContextArtifactMetadata; data: unknown }>,
  ): Promise<string[]> {
    if (this.artifactStore) return this.artifactStore.save(rows)
    const { insertContextArtifacts } = await import("./context-artifacts")
    return insertContextArtifacts(rows)
  }

  private buildTranscript(messages: ModelMessage[]): string {
    return messages
      .map((message) => {
        switch (message.role) {
          case "user":
            return `[User]\n${this.extractText(message.content)}`
          case "assistant":
            return `[Assistant]\n${this.extractAssistantText(message.content)}`
          case "tool":
            return `[Tool Result]\n${this.extractToolText(message.content)}`
          default:
            return `[${message.role}]\n${this.extractText(message.content)}`
        }
      })
      .join("\n\n")
  }

  private extractText(content: ModelMessage["content"]): string {
    return extractTextFromContent(content)
  }

  private extractAssistantText(content: ModelMessage["content"]): string {
    if (typeof content === "string") {
      return content
    }
    if (!Array.isArray(content)) {
      return JSON.stringify(content)
    }
    return content
      .map((part) => {
        if (part.type === "text" || part.type === "reasoning") {
          return part.text
        }
        if (part.type === "tool-call") {
          return `(tool-call ${part.toolName}: ${JSON.stringify(part.input)})`
        }
        return JSON.stringify(part)
      })
      .join("\n")
  }

  private extractToolText(content: ModelMessage["content"]): string {
    if (typeof content === "string") {
      return content
    }
    if (!Array.isArray(content)) {
      return JSON.stringify(content)
    }
    return content
      .map((part) => {
        if (part.type === "tool-result") {
          const value =
            part.output && "value" in part.output
              ? part.output.value
              : part.output
          const rendered =
            typeof value === "string" ? value : JSON.stringify(value)
          return `(${part.toolName}) ${rendered}`
        }
        return JSON.stringify(part)
      })
      .join("\n")
  }

  private buildSummarizeFn(
    stateManager: AgentStateManager,
    summaryStream: BilledLlmStream,
    abortSignal: AbortSignal,
    runId: string,
  ): SummarizeFn {
    return async ({ systemPrompt, transcript }) => {
      const messages: ModelMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: [{ type: "text", text: transcript }] },
      ]
      const input: BillableLlmInput = {
        messages,
        stream: false,
        estimatedInputTokens: estimateInputTokens(messages, 1.15),
        estimatedOutputTokens: DEFAULT_SUMMARY_OUTPUT_TOKENS,
        telemetryFunctionId: "compress-context",
      }
      const stream = summaryStream(input, {
        organizationId: this.session.organizationId,
        userId: this.session.userId,
        signal: abortSignal,
        metadata: {
          sessionId: this.session.id,
          conversationId: this.session.conversationId,
          conversationRunId: this.session.runId,
          runId,
        },
      })

      const result = await drainStreamForComplete(stream)
      if (!result) {
        return ""
      }
      stateManager.incrementUsage(result.usage)
      if (result.vendor) stateManager.recordVendor(result.vendor)
      return result.text
    }
  }

  private async getSummaryStream(): Promise<BilledLlmStream | null> {
    if (this.summaryStream !== undefined) {
      return this.summaryStream
    }

    const model = await this.session.resolveModel(this.summaryModelId)
    if (!model) {
      this.summaryStream = null
      return null
    }

    const summaryClient = createBillableLlmClient({
      model,
      modelConfig: {
        reasoningEffort: "low",
        maxOutputTokens: DEFAULT_SUMMARY_OUTPUT_TOKENS,
      },
    })
    this.summaryStream = withBillingStream(summaryClient, billingService)
    return this.summaryStream
  }
}

type ToolResultJob = {
  messageIndex: number
  partIndex: number
  toolName: string
  toolCallId: string
  output: unknown
}

function collectToolResultJobs(messages: ModelMessage[]): ToolResultJob[] {
  const jobs: ToolResultJob[] = []
  messages.forEach((message, messageIndex) => {
    if (message.role !== "tool" || !Array.isArray(message.content)) return
    message.content.forEach((part, partIndex) => {
      if (part.type !== "tool-result") return
      jobs.push({
        messageIndex,
        partIndex,
        toolName: part.toolName,
        toolCallId: part.toolCallId,
        output: part.output,
      })
    })
  })
  return jobs
}

function applyToolResultArtifacts(
  messages: ModelMessage[],
  jobs: ToolResultJob[],
  ids: string[],
): ModelMessage[] {
  const replacements = new Map(
    jobs.map((job, index) => [`${job.messageIndex}:${job.partIndex}`, ids[index]]),
  )
  return messages.map((message, messageIndex) => {
    if (message.role !== "tool" || !Array.isArray(message.content)) {
      return message
    }
    let changed = false
    const content = message.content.map((part, partIndex) => {
      const artifactId = replacements.get(`${messageIndex}:${partIndex}`)
      if (!artifactId || part.type !== "tool-result") return part
      changed = true
      return {
        ...part,
        output: {
          type: "text" as const,
          value: truncatedToolResult(part.output, artifactId),
        },
      }
    })
    return changed ? { ...message, content } : message
  })
}

function sameMessages(left: ModelMessage[], right: ModelMessage[]): boolean {
  return (
    left.length === right.length &&
    left.every((message, index) => message === right[index])
  )
}

async function drainStreamForComplete(
  stream: AsyncGenerator<LlmChunk, void, unknown>,
): Promise<{ text: string; usage: TokenUsage; vendor?: string } | null> {
  let result: { text: string; usage: TokenUsage; vendor?: string } | null = null
  for await (const chunk of stream) {
    if (chunk.type === streamEvents.complete) {
      result = { text: chunk.text, usage: chunk.usage, vendor: chunk.vendor }
    }
  }
  return result
}
