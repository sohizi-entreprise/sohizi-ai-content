import { createHash } from "crypto"
import { PROVIDE_STATUS_UPDATE_TOOL_NAME } from "../tools/progress-update"

export type ActionCategory = "write" | "read" | "meta" | "job-poll"

export type LoopKind =
  | "exact_repeat"
  | "error_streak"
  | "job_poll_loop"
  | "oscillation"
  | "no_progress_stall"

export type LoopAction = "none" | "nudge" | "stop"

export type LoopVerdict =
  | {
      action: "none"
    }
  | {
      action: "nudge" | "stop"
      kind: LoopKind
      reason: string
      target?: string
      endpoint?: string
      toolName?: string
      count: number
    }

export type ToolCallExecutionInput = {
  toolCallId?: string
  toolName: string
  input: unknown
  success: boolean
  output: string
}

export type StepActionRecord = {
  step: number
  toolName: string
  endpoint?: string
  method?: string
  targetKey: string
  signature: string
  outputHash: string
  pairKey: string
  success: boolean
  category: ActionCategory
  jobId?: string
}

export type LoopDetectorConfig = {
  exactRepeatNudgeThreshold?: number
  exactRepeatStopThreshold?: number
  exactRepeatWindowSteps?: number
  exactRepeatStopWindowSteps?: number
  errorStreakNudgeThreshold?: number
  errorStreakStopThreshold?: number
  jobPollNudgeThreshold?: number
  jobPollStopThreshold?: number
  oscillationNudgeCycles?: number
  oscillationStopCycles?: number
  metaStallNudgeSteps?: number
  metaStallStopSteps?: number
  stallWindowNudgeSteps?: number
  stallWindowStopSteps?: number
  stallUniqueRatioThreshold?: number
  maxNudgesBeforeStop?: number
}

const DEFAULT_CONFIG: Required<LoopDetectorConfig> = {
  exactRepeatNudgeThreshold: 3,
  exactRepeatStopThreshold: 5,
  exactRepeatWindowSteps: 5,
  exactRepeatStopWindowSteps: 8,
  errorStreakNudgeThreshold: 3,
  errorStreakStopThreshold: 5,
  jobPollNudgeThreshold: 3,
  jobPollStopThreshold: 6,
  oscillationNudgeCycles: 2,
  oscillationStopCycles: 3,
  metaStallNudgeSteps: 4,
  metaStallStopSteps: 7,
  stallWindowNudgeSteps: 8,
  stallWindowStopSteps: 14,
  stallUniqueRatioThreshold: 0.35,
  maxNudgesBeforeStop: 2,
}

const META_TOOLS = new Set([
  PROVIDE_STATUS_UPDATE_TOOL_NAME,
  "manageTasks",
  "manageTodoList",
  "apiDocRead",
])

const STANDALONE_WRITE_TOOLS = new Set(["saveMemory", "submitHtmlComposition"])

const MUTATING_API_TOOLS = new Set(["fileSystemAPI", "videoEditorAPI"])

const MUTATING_HTTP_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

const MEDIA_WRITE_ENDPOINTS = new Set([
  "/media/assets/generate",
  "/media/assets/save",
])

const JOB_POLL_ENDPOINTS = new Set(["/media/jobs/status", "/media/jobs/wait"])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue)
  }
  if (isPlainRecord(value)) {
    const sortedKeys = Object.keys(value).sort()
    const result: Record<string, unknown> = {}
    for (const key of sortedKeys) {
      const item = value[key]
      if (item !== undefined) {
        result[key] = canonicalizeValue(item)
      }
    }
    return result
  }
  return value
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value)) ?? "null"
}

function sha256Short(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16)
}

function extractApiMetadata(input: unknown): {
  endpoint?: string
  method?: string
  jobId?: string
} {
  if (!isPlainRecord(input)) {
    return {}
  }
  const endpoint =
    typeof input.endpoint === "string" ? input.endpoint.trim() : undefined
  const method =
    typeof input.method === "string"
      ? input.method.trim().toUpperCase()
      : undefined

  let jobId: string | undefined
  if (isPlainRecord(input.params) && typeof input.params.jobId === "string") {
    jobId = input.params.jobId
  } else if (
    isPlainRecord(input.body) &&
    typeof input.body.jobId === "string"
  ) {
    jobId = input.body.jobId
  }

  return { endpoint, method, jobId }
}

export function classifyActionCategory(
  toolName: string,
  endpoint: string | undefined,
  method: string | undefined,
  success: boolean,
): ActionCategory {
  if (META_TOOLS.has(toolName)) {
    return "meta"
  }

  if (
    toolName === "mediaOperationsAPI" &&
    endpoint &&
    JOB_POLL_ENDPOINTS.has(endpoint)
  ) {
    return "job-poll"
  }

  if (!success) {
    return "read"
  }

  if (STANDALONE_WRITE_TOOLS.has(toolName)) {
    return "write"
  }

  if (
    MUTATING_API_TOOLS.has(toolName) &&
    method &&
    MUTATING_HTTP_METHODS.has(method)
  ) {
    return "write"
  }

  if (
    toolName === "mediaOperationsAPI" &&
    endpoint &&
    MEDIA_WRITE_ENDPOINTS.has(endpoint)
  ) {
    return "write"
  }

  return "read"
}

export class LoopDetector {
  private readonly config: Required<LoopDetectorConfig>
  private stepRecords: Map<number, StepActionRecord[]> = new Map()
  private allRecords: StepActionRecord[] = []
  private errorStreaks: Map<
    string,
    { count: number; toolName: string; endpoint?: string }
  > = new Map()
  private jobStatusPollCounts: Map<string, number> = new Map()
  private consecutiveMetaOnlySteps = 0
  private lastWriteStep = 0
  private nudgesIssued = 0
  private nudgesByPatternKey: Map<string, number> = new Map()
  private lastNudgedStepByPatternKey: Map<string, number> = new Map()
  private latestStep = 0

  constructor(config?: LoopDetectorConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    }
  }

  reset(): void {
    this.stepRecords.clear()
    this.allRecords = []
    this.errorStreaks.clear()
    this.jobStatusPollCounts.clear()
    this.consecutiveMetaOnlySteps = 0
    this.lastWriteStep = 0
    this.nudgesIssued = 0
    this.nudgesByPatternKey.clear()
    this.lastNudgedStepByPatternKey.clear()
    this.latestStep = 0
  }

  recordStep(step: number, executions: ToolCallExecutionInput[]): void {
    this.latestStep = step
    if (executions.length === 0) {
      return
    }

    const records: StepActionRecord[] = []
    let hadWriteThisStep = false

    for (const exec of executions) {
      const { endpoint, method, jobId } = extractApiMetadata(exec.input)
      const category = classifyActionCategory(
        exec.toolName,
        endpoint,
        method,
        exec.success,
      )
      const targetKey = endpoint
        ? `${exec.toolName}:${endpoint}`
        : exec.toolName
      const signature = sha256Short(
        `${exec.toolName}|${endpoint ?? ""}|${method ?? ""}|${stableStringify(exec.input)}`,
      )
      const outputHash = sha256Short(`${exec.success}|${exec.output}`)
      const pairKey = `${signature}:${outputHash}`

      const record: StepActionRecord = {
        step,
        toolName: exec.toolName,
        endpoint,
        method,
        targetKey,
        signature,
        outputHash,
        pairKey,
        success: exec.success,
        category,
        jobId,
      }
      records.push(record)
      this.allRecords.push(record)

      if (category === "write") {
        hadWriteThisStep = true
      }

      // Track consecutive error streaks per targetKey
      if (category !== "meta") {
        if (!exec.success) {
          const prev = this.errorStreaks.get(targetKey)
          this.errorStreaks.set(targetKey, {
            count: (prev?.count ?? 0) + 1,
            toolName: exec.toolName,
            endpoint,
          })
        } else {
          this.errorStreaks.delete(targetKey)
        }
      }

      // Track /media/jobs/status polling vs /media/jobs/wait
      if (exec.toolName === "mediaOperationsAPI" && jobId) {
        if (endpoint === "/media/jobs/status") {
          const prev = this.jobStatusPollCounts.get(jobId) ?? 0
          this.jobStatusPollCounts.set(jobId, prev + 1)
        } else if (endpoint === "/media/jobs/wait") {
          this.jobStatusPollCounts.delete(jobId)
        }
      }
    }

    this.stepRecords.set(step, records)

    const isMetaOnly = records.every((r) => r.category === "meta")
    if (isMetaOnly) {
      this.consecutiveMetaOnlySteps += 1
    } else {
      this.consecutiveMetaOnlySteps = 0
    }

    if (hadWriteThisStep) {
      this.lastWriteStep = step
      this.nudgesIssued = 0
      this.nudgesByPatternKey.clear()
    }
  }

  evaluate(step: number = this.latestStep): LoopVerdict {
    if (step <= 0 || !this.stepRecords.has(step)) {
      return { action: "none" }
    }

    const candidates: Array<{
      patternKey: string
      rawAction: "nudge" | "stop"
      kind: LoopKind
      reason: string
      target?: string
      endpoint?: string
      toolName?: string
      count: number
    }> = []

    const exactRepeat = this.detectExactRepeat(step)
    if (exactRepeat) candidates.push(exactRepeat)

    const errorStreak = this.detectErrorStreak(step)
    if (errorStreak) candidates.push(errorStreak)

    const jobPoll = this.detectJobPollLoop(step)
    if (jobPoll) candidates.push(jobPoll)

    const oscillation = this.detectOscillation(step)
    if (oscillation) candidates.push(oscillation)

    const stall = this.detectNoProgressStall(step)
    if (stall) candidates.push(stall)

    if (candidates.length === 0) {
      return { action: "none" }
    }

    // Prefer stop candidates first, otherwise take highest priority candidate
    const stopCandidate = candidates.find((c) => c.rawAction === "stop")
    const chosen = stopCandidate ?? candidates[0]!

    return this.resolveEscalation(step, chosen)
  }

  private resolveEscalation(
    step: number,
    candidate: {
      patternKey: string
      rawAction: "nudge" | "stop"
      kind: LoopKind
      reason: string
      target?: string
      endpoint?: string
      toolName?: string
      count: number
    },
  ): LoopVerdict {
    const previousNudgesForPattern =
      this.nudgesByPatternKey.get(candidate.patternKey) ?? 0
    const lastNudgedStep = this.lastNudgedStepByPatternKey.get(
      candidate.patternKey,
    )

    if (candidate.rawAction === "stop") {
      return {
        action: "stop",
        kind: candidate.kind,
        reason: candidate.reason,
        target: candidate.target,
        endpoint: candidate.endpoint,
        toolName: candidate.toolName,
        count: candidate.count,
      }
    }

    // Avoid re-nudging on the exact same step if evaluate() is called twice
    if (lastNudgedStep === step) {
      return { action: "none" }
    }

    // If we already nudged this exact pattern and the agent kept repeating it,
    // or total nudges since the last write reached maxNudgesBeforeStop, escalate to stop
    if (
      previousNudgesForPattern >= 1 &&
      lastNudgedStep !== undefined &&
      step > lastNudgedStep &&
      this.nudgesIssued >= this.config.maxNudgesBeforeStop
    ) {
      return {
        action: "stop",
        kind: candidate.kind,
        reason: `${candidate.reason} (persisted after ${this.nudgesIssued} loop warnings)`,
        target: candidate.target,
        endpoint: candidate.endpoint,
        toolName: candidate.toolName,
        count: candidate.count,
      }
    }

    // If we nudged this exact pattern on the immediately preceding step, give the agent
    // at least 1 step before issuing a duplicate nudge unless it hit the stop threshold
    if (
      previousNudgesForPattern >= 1 &&
      lastNudgedStep !== undefined &&
      step - lastNudgedStep < 2
    ) {
      return { action: "none" }
    }

    this.nudgesIssued += 1
    this.nudgesByPatternKey.set(
      candidate.patternKey,
      previousNudgesForPattern + 1,
    )
    this.lastNudgedStepByPatternKey.set(candidate.patternKey, step)

    return {
      action: "nudge",
      kind: candidate.kind,
      reason: candidate.reason,
      target: candidate.target,
      endpoint: candidate.endpoint,
      toolName: candidate.toolName,
      count: candidate.count,
    }
  }

  private detectExactRepeat(step: number) {
    const currentRecords = this.stepRecords.get(step) ?? []
    const nonPollCurrent = currentRecords.filter(
      (r) => r.category !== "job-poll" && r.category !== "meta",
    )
    if (nonPollCurrent.length === 0) {
      return null
    }

    const stopMinStep = Math.max(
      1,
      step - this.config.exactRepeatStopWindowSteps + 1,
    )
    const nudgeMinStep = Math.max(
      1,
      step - this.config.exactRepeatWindowSteps + 1,
    )

    for (const current of nonPollCurrent) {
      let countInStopWindow = 0
      let countInNudgeWindow = 0

      for (const record of this.allRecords) {
        if (record.pairKey !== current.pairKey) continue
        if (record.step >= stopMinStep && record.step <= step) {
          countInStopWindow += 1
        }
        if (record.step >= nudgeMinStep && record.step <= step) {
          countInNudgeWindow += 1
        }
      }

      const label = current.endpoint
        ? `${current.toolName} (${current.method ?? ""} ${current.endpoint})`.trim()
        : current.toolName

      if (countInStopWindow >= this.config.exactRepeatStopThreshold) {
        return {
          patternKey: `exact_repeat:${current.pairKey}`,
          rawAction: "stop" as const,
          kind: "exact_repeat" as const,
          reason: `Repeated identical call to ${label} ${countInStopWindow} times with identical output.`,
          target: current.targetKey,
          endpoint: current.endpoint,
          toolName: current.toolName,
          count: countInStopWindow,
        }
      }

      if (countInNudgeWindow >= this.config.exactRepeatNudgeThreshold) {
        return {
          patternKey: `exact_repeat:${current.pairKey}`,
          rawAction: "nudge" as const,
          kind: "exact_repeat" as const,
          reason: `Repeated identical call to ${label} ${countInNudgeWindow} times with the exact same result.`,
          target: current.targetKey,
          endpoint: current.endpoint,
          toolName: current.toolName,
          count: countInNudgeWindow,
        }
      }
    }

    return null
  }

  private detectErrorStreak(step: number) {
    const currentRecords = this.stepRecords.get(step) ?? []
    const failedCurrent = currentRecords.filter(
      (r) => !r.success && r.category !== "meta",
    )
    if (failedCurrent.length === 0) {
      return null
    }

    for (const failed of failedCurrent) {
      const streak = this.errorStreaks.get(failed.targetKey)
      if (!streak) continue

      const label = failed.endpoint
        ? `${failed.toolName} (${failed.endpoint})`
        : failed.toolName

      if (streak.count >= this.config.errorStreakStopThreshold) {
        return {
          patternKey: `error_streak:${failed.targetKey}`,
          rawAction: "stop" as const,
          kind: "error_streak" as const,
          reason: `Tool ${label} failed ${streak.count} consecutive times without recovery.`,
          target: failed.targetKey,
          endpoint: failed.endpoint,
          toolName: failed.toolName,
          count: streak.count,
        }
      }

      if (streak.count >= this.config.errorStreakNudgeThreshold) {
        return {
          patternKey: `error_streak:${failed.targetKey}`,
          rawAction: "nudge" as const,
          kind: "error_streak" as const,
          reason: `Tool ${label} failed ${streak.count} consecutive times.`,
          target: failed.targetKey,
          endpoint: failed.endpoint,
          toolName: failed.toolName,
          count: streak.count,
        }
      }
    }

    return null
  }

  private detectJobPollLoop(step: number) {
    const currentRecords = this.stepRecords.get(step) ?? []
    for (const record of currentRecords) {
      if (
        record.toolName === "mediaOperationsAPI" &&
        record.endpoint === "/media/jobs/status" &&
        record.jobId
      ) {
        const count = this.jobStatusPollCounts.get(record.jobId) ?? 0
        if (count >= this.config.jobPollStopThreshold) {
          return {
            patternKey: `job_poll:${record.jobId}`,
            rawAction: "stop" as const,
            kind: "job_poll_loop" as const,
            reason: `Polled GET /media/jobs/status for job "${record.jobId}" ${count} times instead of waiting for completion.`,
            target: `mediaOperationsAPI:/media/jobs/status:${record.jobId}`,
            endpoint: "/media/jobs/status",
            toolName: "mediaOperationsAPI",
            count,
          }
        }
        if (count >= this.config.jobPollNudgeThreshold) {
          return {
            patternKey: `job_poll:${record.jobId}`,
            rawAction: "nudge" as const,
            kind: "job_poll_loop" as const,
            reason: `Polled GET /media/jobs/status for job "${record.jobId}" ${count} times.`,
            target: `mediaOperationsAPI:/media/jobs/status:${record.jobId}`,
            endpoint: "/media/jobs/status",
            toolName: "mediaOperationsAPI",
            count,
          }
        }
      }
    }
    return null
  }

  private detectOscillation(step: number) {
    const stopStepsNeeded = this.config.oscillationStopCycles * 2
    const nudgeStepsNeeded = this.config.oscillationNudgeCycles * 2

    if (step < nudgeStepsNeeded) {
      return null
    }

    // Build per-step composite signature for recent steps since last write
    const stepSignatures: Array<{
      step: number
      sig: string
      label: string
      hadWrite: boolean
    }> = []

    const lookbackStart = Math.max(
      this.lastWriteStep + 1,
      step - stopStepsNeeded + 1,
    )

    for (let s = lookbackStart; s <= step; s++) {
      const records = (this.stepRecords.get(s) ?? []).filter(
        (r) => r.category !== "meta",
      )
      if (records.length === 0) {
        return null
      }
      const hadWrite = records.some((r) => r.category === "write")
      if (hadWrite) {
        return null
      }
      const sig = records.map((r) => r.signature).join("+")
      const label = records
        .map((r) => (r.endpoint ? `${r.toolName}:${r.endpoint}` : r.toolName))
        .join(", ")
      stepSignatures.push({ step: s, sig, label, hadWrite })
    }

    const checkAlternating = (windowLen: number): boolean => {
      if (stepSignatures.length < windowLen) return false
      const slice = stepSignatures.slice(-windowLen)
      const sigA = slice[0]!.sig
      const sigB = slice[1]!.sig
      if (sigA === sigB) return false
      for (let i = 0; i < slice.length; i++) {
        const expected = i % 2 === 0 ? sigA : sigB
        if (slice[i]!.sig !== expected) return false
      }
      return true
    }

    if (checkAlternating(stopStepsNeeded)) {
      const slice = stepSignatures.slice(-stopStepsNeeded)
      const labelA = slice[0]!.label
      const labelB = slice[1]!.label
      const pairKey = [slice[0]!.sig, slice[1]!.sig].sort().join(":")
      return {
        patternKey: `oscillation:${pairKey}`,
        rawAction: "stop" as const,
        kind: "oscillation" as const,
        reason: `Agent oscillated between (${labelA}) and (${labelB}) for ${this.config.oscillationStopCycles} cycles without progress.`,
        target: `${labelA} <-> ${labelB}`,
        count: stopStepsNeeded,
      }
    }

    if (checkAlternating(nudgeStepsNeeded)) {
      const slice = stepSignatures.slice(-nudgeStepsNeeded)
      const labelA = slice[0]!.label
      const labelB = slice[1]!.label
      const pairKey = [slice[0]!.sig, slice[1]!.sig].sort().join(":")
      return {
        patternKey: `oscillation:${pairKey}`,
        rawAction: "nudge" as const,
        kind: "oscillation" as const,
        reason: `Agent is oscillating between (${labelA}) and (${labelB}) without making state changes.`,
        target: `${labelA} <-> ${labelB}`,
        count: nudgeStepsNeeded,
      }
    }

    return null
  }

  private detectNoProgressStall(step: number) {
    // Case A: Consecutive meta-only steps (e.g. only calling provideStatusUpdate / manageTasks)
    if (this.consecutiveMetaOnlySteps >= this.config.metaStallStopSteps) {
      return {
        patternKey: "no_progress_stall:meta_only",
        rawAction: "stop" as const,
        kind: "no_progress_stall" as const,
        reason: `Executed ${this.consecutiveMetaOnlySteps} consecutive status/task-management steps without invoking any action tools.`,
        count: this.consecutiveMetaOnlySteps,
      }
    }

    if (this.consecutiveMetaOnlySteps >= this.config.metaStallNudgeSteps) {
      return {
        patternKey: "no_progress_stall:meta_only",
        rawAction: "nudge" as const,
        kind: "no_progress_stall" as const,
        reason: `Executed ${this.consecutiveMetaOnlySteps} consecutive status/task-management steps without invoking any action tools.`,
        count: this.consecutiveMetaOnlySteps,
      }
    }

    // Case B: High window of steps since last write where unique signatures ratio is below threshold
    const stepsSinceWrite = step - this.lastWriteStep
    if (stepsSinceWrite < this.config.stallWindowNudgeSteps) {
      return null
    }

    const windowRecords = this.allRecords.filter(
      (r) => r.step > this.lastWriteStep && r.category !== "meta",
    )
    if (windowRecords.length < this.config.stallWindowNudgeSteps) {
      return null
    }

    const uniqueSignatures = new Set(windowRecords.map((r) => r.signature)).size
    const uniqueRatio = uniqueSignatures / windowRecords.length

    if (uniqueRatio >= this.config.stallUniqueRatioThreshold) {
      return null
    }

    if (stepsSinceWrite >= this.config.stallWindowStopSteps) {
      return {
        patternKey: "no_progress_stall:low_diversity",
        rawAction: "stop" as const,
        kind: "no_progress_stall" as const,
        reason: `No progress for ${stepsSinceWrite} steps (${uniqueSignatures} unique actions across ${windowRecords.length} tool calls).`,
        count: stepsSinceWrite,
      }
    }

    return {
      patternKey: "no_progress_stall:low_diversity",
      rawAction: "nudge" as const,
      kind: "no_progress_stall" as const,
      reason: `Low action diversity over the last ${stepsSinceWrite} steps (${uniqueSignatures} unique actions across ${windowRecords.length} tool calls) with no state changes.`,
      count: stepsSinceWrite,
    }
  }
}

export function formatLoopWarningNote(verdict: LoopVerdict): string {
  if (verdict.action === "none") {
    return ""
  }

  const guidanceLines: string[] = [
    "Do NOT repeat the same tool call with identical parameters.",
  ]

  if (
    verdict.kind === "job_poll_loop" ||
    verdict.endpoint === "/media/jobs/status"
  ) {
    guidanceLines.push(
      'Instead of polling `GET /media/jobs/status` repeatedly, call `POST /media/jobs/wait` with `{ "jobId": "..." }` to wait for the job to finish, or finish your turn if you do not need the result immediately.',
    )
  } else if (verdict.endpoint === "/files/patch") {
    guidanceLines.push(
      'Your `/files/patch` calls are failing repeatedly. Read the latest file content with `GET /files/read` to verify exact lines, or use `POST /files/write` with `strategy: "overwrite"` instead.',
    )
  } else if (verdict.kind === "error_streak") {
    guidanceLines.push(
      "Check the API schema/documentation using `apiDocRead` or inspect existing state before retrying, or switch to an alternative endpoint.",
    )
  } else if (verdict.kind === "no_progress_stall") {
    guidanceLines.push(
      "Stop emitting only status updates or re-reading the same resources. Either execute the next concrete action or return your final response to the user.",
    )
  } else {
    guidanceLines.push(
      "Change your strategy: use a different endpoint/tool, verify assumptions with a different query, or if you are blocked, stop calling tools and explain the blocker to the user.",
    )
  }

  return `<loop_warning kind="${verdict.kind}">
Loop detected: ${verdict.reason}
${guidanceLines.map((line) => `- ${line}`).join("\n")}
</loop_warning>`
}

export function formatLoopStopNote(verdict: LoopVerdict): string {
  if (verdict.action === "none") {
    return ""
  }

  return `<loop_stop kind="${verdict.kind}">
Execution has been stopped because a persistent loop was detected: ${verdict.reason}
Tool calls are disabled for this final turn.
Write a clear, helpful response to the user that:
- Summarizes what you have already completed or found so far.
- Clearly explains the blocker or repeated issue that prevented you from finishing.
- Suggests next steps or asks the user how they would like to proceed.
</loop_stop>`
}
