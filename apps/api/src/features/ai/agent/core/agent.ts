import {
  AssistantContent,
  ModelMessage,
  SystemModelMessage,
  ToolModelMessage,
  UserModelMessage,
} from "ai"
import {
  contextNote,
  restoreSessionMessages,
  withoutSohiziProviderOptions,
} from "./system-persist"
import {
  createBillableLlmClient,
  type BillableLlmClient,
  type BillableLlmInput,
  type ModelConfig,
} from "../utils/llm-client"
import type { ResolvedTextModel } from "@/features/models/repo"
import {
  LlmChunk,
  OperationChunk,
  streamEvents,
  ToolCall,
  ToolResultComplete,
} from "../utils/llm-response"
import { v4 as uuidv4 } from "uuid"
import { getTool } from "../tools/tool-registry"
import { mergeGenerators } from "../utils/merge-generators"
import { Session } from "./session"
import { AgentJob, AgentState, CompleteReason, TokenUsage } from "@/type"
import { billingService, withBillingStream } from "@/features/billing"
import { AgentStateManager } from "./state-manager"
import { Persistence } from "./persistence"
import { estimateInputTokens } from "../utils/estimate-token"
import { ContextManager } from "./context-manager"
import { getErrorMessage } from "@/utils/get-error-message"
import { observeToolExecution } from "../utils/tracing"
import {
  extractStatusUpdateMessage,
  PROVIDE_STATUS_UPDATE_TOOL_NAME,
} from "../tools/progress-update"
import { refreshAgentJobs } from "../tools/job-sync"
import {
  formatJobUpdateNote,
  formatPendingJobReminder,
} from "../tools/job-status"

const DEFAULT_OUTPUT_TOKEN_ESTIMATE = 4096

export type AgentChunk = {
  name: string
  runId: string
} & (LlmChunk | ToolResultComplete | OperationChunk)

type AgentConfig = {
  model: ResolvedTextModel
  modelConfig: ModelConfig
  session: Session
  name: string
  systemPrompt: string
  persistence?: Persistence
  maxContextTokens: number
  contextThreshold?: number
  summaryModelId: string
}

type BilledLlmStream = ReturnType<
  typeof withBillingStream<BillableLlmInput, LlmChunk>
>

export class Agent {
  public stateManager: AgentStateManager
  private readonly name: string
  private runId: string | null
  private readonly session: Session
  private readonly persistence: Persistence | undefined
  private readonly agentParams: Pick<AgentConfig, "name" | "systemPrompt">
  private readonly modelConfig: ModelConfig
  private readonly model: ResolvedTextModel
  private readonly contextManager: ContextManager
  public artifacts: Map<string, unknown>

  constructor(config: AgentConfig) {
    this.name = config.name
    this.runId = null
    this.session = config.session
    this.stateManager = new AgentStateManager()
    this.persistence = config.persistence
    this.agentParams = {
      name: config.name,
      systemPrompt: config.systemPrompt,
    }
    this.modelConfig = config.modelConfig
    this.model = config.model
    this.contextManager = new ContextManager({
      maxContextTokens: config.maxContextTokens,
      threshold: config.contextThreshold,
      session: config.session,
      summaryModelId: config.summaryModelId,
    })
    this.artifacts = new Map()
  }

  async *runLoop(
    ursMsg: UserModelMessage | (UserModelMessage | SystemModelMessage)[],
    abortSignal: AbortSignal,
    maxSteps: number = 25,
  ): AsyncGenerator<AgentChunk, void, unknown> {
    try {
      const billableLlmClient = await this.buildBillableLlmClient()
      const billedLlmStream = withBillingStream(
        billableLlmClient,
        billingService,
      )

      this.initializeState(this.agentParams.systemPrompt)
      this.registerMessage(ursMsg)

      let pendingJobReminderSent = false
      for (let step = 1; step <= maxSteps; step++) {
        if (this.stateManager.isExitStatus) {
          break
        }
        yield* this.runStep(billedLlmStream, abortSignal, step)
        yield* this.drainCompletedJobs()

        if (
          this.stateManager.isExitStatus &&
          this.stateManager.hasPendingJobs() &&
          !pendingJobReminderSent &&
          !abortSignal.aborted &&
          this.stateManager.status !== "error"
        ) {
          pendingJobReminderSent = true
          this.stateManager.startRun()
          this.stateManager.setFinishReason(null)
          this.injectJobNote(
            formatPendingJobReminder(this.stateManager.getPendingJobs()),
          )
        }

        await this.contextManager.maybeCompress(
          this.stateManager,
          this.stateManager.getState().latestRunUsage?.input ?? 0,
          abortSignal,
          this.ensureRunId(),
        )
      }

      if (this.stateManager.isRunning) {
        this.stateManager.finishRun()
      }
    } catch (error) {
      console.log("runLoop error", error)
      const errorMessage = this.captureStepError(error)
      yield this.buildErrorEvent(errorMessage)
    } finally {
      this.stateManager.dropNotifiedTerminalJobs()
      // Persist optionally based on the agent config
      await this.persistence?.persist(
        this.stateManager.getState(),
        this.stateManager.fulfilledVendor,
        this.stateManager.usageThisRun,
      )
      yield this.buildUsageEvent()
    }
  }

  async *runStep(
    callClient: BilledLlmStream,
    abortSignal: AbortSignal,
    _step: number,
  ): AsyncGenerator<AgentChunk, void, unknown> {
    // Future implementation: context summarization + pruning && user limit checking
    // Future persist messages to the database [checkpoints]
    this.runId = uuidv4()
    const tool_calls: ToolCall[] = []
    const statusUpdateToolCallIds = new Set<string>()
    let reasoning_text = ""
    let text = ""
    let stepError: string | null = null
    let assistantMessageRegistered = false
    let toolCallsStarted = false

    await this.contextManager.maybeCompress(
      this.stateManager,
      estimateInputTokens(this.stateManager.getState().messages, 1.15),
      abortSignal,
      this.ensureRunId(),
    )
    const stateMessages = this.modelMessages()

    const billableInput: BillableLlmInput = {
      messages: stateMessages,
      estimatedInputTokens: estimateInputTokens(stateMessages, 1.15),
      estimatedOutputTokens: DEFAULT_OUTPUT_TOKEN_ESTIMATE,
    }

    // `withBillingStream` reserves up-front, settles on the terminal
    // `complete` chunk, and refunds on error / early termination.
    // The agent sees only LLM chunks; billing is invisible to this loop.
    const billedStream = callClient(billableInput, {
      organizationId: this.session.organizationId,
      userId: this.session.userId,
      signal: abortSignal,
      metadata: {
        sessionId: this.session.id,
        conversationId: this.session.conversationId,
        conversationRunId: this.session.runId,
        runId: this.runId,
      },
    })

    const registerAssistantMessage = () => {
      if (assistantMessageRegistered) return

      const content = this.buildAssistantContent(
        reasoning_text,
        text,
        tool_calls,
        stepError,
      )
      if (content.length > 0) {
        this.registerMessage({
          role: "assistant",
          content,
        })
      }
      assistantMessageRegistered = true
    }

    try {
      for await (const chunk of billedStream) {
        switch (chunk.type) {
          case streamEvents.textDelta:
            text = chunk.text
            yield this.buildEvent(chunk)
            break
          case streamEvents.reasoningDelta:
            reasoning_text = chunk.text
            yield this.buildEvent(chunk)
            break
          case streamEvents.error:
            yield this.buildEvent(chunk)
            break
          case streamEvents.complete:
            this.stateManager.recordModelStepUsage(chunk.usage)
            if (chunk.vendor) this.stateManager.recordVendor(chunk.vendor)
            this.updateStatus(chunk.finishReason, chunk.error)
            text = chunk.text || text
            reasoning_text = chunk.reasoningText ?? reasoning_text
            if (chunk.finishReason === "error") {
              stepError = chunk.error ?? "Unknown agent error"
              this.captureStepError(stepError)
            }
            yield this.buildUsageEvent()
            break
          case streamEvents.toolCallStart:
            if (chunk.toolName === PROVIDE_STATUS_UPDATE_TOOL_NAME) {
              statusUpdateToolCallIds.add(chunk.toolCallId)
            } else {
              yield this.buildEvent(chunk)
            }
            break
          case streamEvents.toolCallDelta:
            if (statusUpdateToolCallIds.has(chunk.toolCallId)) {
              const message = extractStatusUpdateMessage(chunk.input)
              if (message !== null) {
                yield this.buildEvent({
                  type: streamEvents.progressUpdate,
                  toolCallId: chunk.toolCallId,
                  text: message,
                })
              }
            } else {
              yield this.buildEvent(chunk)
            }
            break
          case streamEvents.toolCallEnd:
            if (!statusUpdateToolCallIds.has(chunk.toolCallId)) {
              yield this.buildEvent(chunk)
            }
            break
          case streamEvents.toolCall:
            tool_calls.push(chunk)
            if (chunk.toolName === PROVIDE_STATUS_UPDATE_TOOL_NAME) {
              statusUpdateToolCallIds.add(chunk.toolCallId)
              const message = extractStatusUpdateMessage(chunk.input)
              if (message !== null) {
                yield this.buildEvent({
                  type: streamEvents.progressUpdate,
                  toolCallId: chunk.toolCallId,
                  text: message,
                })
              }
            } else {
              yield this.buildEvent(chunk)
            }
            break
          default:
            yield this.buildEvent(chunk)
        }
      }

      registerAssistantMessage()

      if (tool_calls.length > 0 && !stepError) {
        toolCallsStarted = true
        yield* this.runToolCalls(tool_calls, abortSignal)
      } else if (!stepError && !this.stateManager.isExitStatus) {
        this.stateManager.finishRun()
      }
    } catch (error) {
      console.log("runStep error", error)
      stepError = this.captureStepError(error)
      yield this.buildErrorEvent(stepError)
    } finally {
      registerAssistantMessage()
      if (stepError && tool_calls.length > 0 && !toolCallsStarted) {
        this.appendToolCallErrors(
          tool_calls,
          `Tool call was not executed because the step failed: ${stepError}`,
        )
      }
    }
  }

  private updateStatus(finishReason: CompleteReason, error?: string) {
    this.stateManager.setFinishReason(finishReason)
    switch (finishReason) {
      case "abort":
        this.stateManager.finishRun()
        break
      case "error":
        this.stateManager.setError(error ?? "Unknown agent error")
        break

      default:
        // Stay running until finalizeStepStatus — a turn may include tool calls
        // even when finishReason is not exactly 'tool-calls'.
        break
    }
  }

  private initializeState(systemPrompt: string) {
    const existingState = this.persistence?.getInitialState()
    let state: AgentState = {
      messages: [{ role: "system", content: systemPrompt }],
      finishReason: null,
      error: null,
      status: "idle",
      todos: [],
      jobs: [],
      usage: null,
      latestRunUsage: null,
    }
    if (existingState) {
      state = {
        ...existingState,
        status: "idle",
        jobs: existingState.jobs ?? [],
        latestRunUsage: existingState.latestRunUsage ?? null,
        messages: restoreSessionMessages(systemPrompt, existingState.messages),
      }
    }

    this.stateManager.setState(state)
    this.stateManager.startRun()
  }

  private async *runToolCalls(
    tool_calls: ToolCall[],
    abortSignal: AbortSignal,
  ): AsyncGenerator<AgentChunk, void, unknown> {
    const generators: AsyncGenerator<
      ToolResultComplete | AgentChunk | OperationChunk,
      void,
      unknown
    >[] = []
    const invalidTools: { toolCallId: string; toolName: string }[] = []
    const validToolCalls: ToolCall[] = []
    const completedToolCallIds = new Set<string>()
    for (const tool_call of tool_calls) {
      const tool = getTool(tool_call.toolName)
      if (!tool) {
        invalidTools.push({
          toolCallId: tool_call.toolCallId,
          toolName: tool_call.toolName,
        })
        continue
      }
      validToolCalls.push(tool_call)
      generators.push(
        observeToolExecution(
          tool_call.toolName,
          tool_call.input,
          tool.execute(tool_call, {
            session: this.session,
            state: this.stateManager,
            abortSignal,
            artifacts: this.artifacts,
            runId: this.ensureRunId(),
          }),
        ),
      )
    }

    if (invalidTools.length > 0) {
      this.appendBadToolNames(invalidTools)
    }

    try {
      for await (const chunk of mergeGenerators(...generators)) {
        if (chunk.type === streamEvents.toolResultComplete) {
          completedToolCallIds.add(chunk.toolCallId)
          this.updateToolResults(chunk)
        }
        yield this.buildEvent(chunk)
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error)
      const incompleteToolCalls = validToolCalls.filter(
        (toolCall) => !completedToolCallIds.has(toolCall.toolCallId),
      )
      this.appendToolCallErrors(incompleteToolCalls, errorMessage)
      // throw error;
    }
  }

  private buildAssistantContent(
    reasoningText: string,
    text: string,
    toolCalls: ToolCall[],
    stepError: string | null,
  ): AssistantContent {
    const content: AssistantContent = []
    if (reasoningText) {
      content.push({ type: "reasoning", text: reasoningText })
    }
    if (text) {
      content.push({ type: "text", text })
    }
    if (stepError) {
      content.push({ type: "text", text: `Step failed: ${stepError}` })
    }
    for (const tool_call of toolCalls) {
      content.push({
        type: "tool-call",
        toolName: tool_call.toolName,
        input: tool_call.input,
        toolCallId: tool_call.toolCallId,
      })
    }
    return content
  }

  private captureStepError(error: unknown): string {
    const message = getErrorMessage(error)
    let isAborted = false
    if (error instanceof Error && error.name === "AbortError") {
      isAborted = true
    }
    this.stateManager.setError(message)
    this.stateManager.setFinishReason(isAborted ? "abort" : "error")

    return message
  }

  private appendToolCallErrors(toolCalls: ToolCall[], errorMessage: string) {
    if (toolCalls.length === 0) return

    const msgs: ToolModelMessage[] = toolCalls.map((toolCall) => ({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          output: {
            type: "error-text",
            value: errorMessage,
          },
        },
      ],
    }))
    this.registerMessage(msgs)
  }

  private updateToolResults(result: ToolResultComplete) {
    const msg: ToolModelMessage = {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: result.toolCallId,
          toolName: result.toolName,
          output: {
            type: result.success ? "text" : "error-text",
            value: result.output,
          },
        },
      ],
    }

    this.registerMessage(msg)
    this.stateManager.incrementUsage({
      ...result.usage,
      modelId: this.model.id,
    })
  }

  private appendBadToolNames(data: { toolCallId: string; toolName: string }[]) {
    const msgs: ToolModelMessage[] = data.map((item) => ({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: item.toolCallId,
          toolName: item.toolName,
          output: {
            type: "error-text",
            value: `Invalid tool name: ${item.toolName}`,
          },
        },
      ],
    }))
    this.registerMessage(msgs)
  }

  private async *drainCompletedJobs(): AsyncGenerator<
    AgentChunk,
    void,
    unknown
  > {
    if (this.stateManager.getState().jobs.length === 0) {
      return
    }

    await refreshAgentJobs(this.session.projectId, this.stateManager)
    const completed = this.stateManager.getUnnotifiedTerminalJobs()
    if (completed.length === 0) {
      return
    }

    this.injectJobNote(formatJobUpdateNote(completed))
    this.stateManager.markJobsNotified(completed.map((job) => job.jobId))

    for (const job of completed) {
      yield this.buildEvent({
        type: streamEvents.progressUpdate,
        toolCallId: job.toolCallId,
        text: progressTextForJob(job),
      })
    }
  }

  private injectJobNote(text: string) {
    this.registerMessage(contextNote(text))
  }

  private modelMessages(): ModelMessage[] {
    return withoutSohiziProviderOptions(this.stateManager.getState().messages)
  }

  private registerMessage(
    message: ModelMessage | ModelMessage[],
    stateOnly: boolean = false,
  ) {
    const messages = Array.isArray(message) ? message : [message]
    this.stateManager.appendMessages(messages)
    if (!stateOnly) {
      this.persistence?.registerMessage(messages)
    }
  }

  private buildEvent(
    chunk: LlmChunk | ToolResultComplete | OperationChunk | AgentChunk,
  ): AgentChunk {
    return {
      ...chunk,
      name: this.name,
      runId: this.ensureRunId(),
    }
  }

  private buildErrorEvent(error: string): AgentChunk {
    return this.buildEvent({
      type: streamEvents.error,
      error,
    })
  }

  private buildUsageEvent(): AgentChunk {
    const usage = this.stateManager.getState().usage
    return this.buildEvent({
      type: streamEvents.usage,
      usage: usage ?? this.emptyUsage(),
      latestRunUsage: this.stateManager.getState().latestRunUsage,
    })
  }

  private emptyUsage(): TokenUsage {
    return {
      input: 0,
      output: 0,
      reasoning: 0,
      cached: 0,
      total: 0,
      modelId: this.model.id,
      cost: 0,
    }
  }

  private ensureRunId(): string {
    if (!this.runId) {
      this.runId = this.session.runId
    }
    return this.runId
  }

  async buildBillableLlmClient(): Promise<BillableLlmClient> {
    return createBillableLlmClient({
      model: this.model,
      modelConfig: this.modelConfig,
    })
  }
}

function progressTextForJob(job: AgentJob): string {
  if (job.status === "failed") {
    return job.error
      ? `Job ${job.label} failed: ${job.error}`
      : `Job ${job.label} failed`
  }
  return `Job ${job.label} completed`
}
