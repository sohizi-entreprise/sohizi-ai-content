import {
  CompleteReason,
  AgentState,
  Runstatus,
  TodoItem,
  TokenUsage,
  AgentJob,
} from "@/type"

function addUsage(current: TokenUsage | null, usage: TokenUsage): TokenUsage {
  if (!current) return usage
  return {
    ...current,
    input: current.input + usage.input || 0,
    output: current.output + usage.output || 0,
    reasoning: current.reasoning + usage.reasoning || 0,
    cached: current.cached + usage.cached || 0,
    total: current.total + usage.total || 0,
    cost: current.cost + usage.cost || 0,
  }
}

export class AgentStateManager {
  private state: AgentState
  private vendors: string[] = []
  private runUsage: TokenUsage | null = null

  constructor(initialState?: AgentState) {
    this.state = initialState ?? {
      status: "idle",
      jobs: [],
      error: null,
      finishReason: null,
      todos: [],
      messages: [],
      usage: null,
      latestRunUsage: null,
    }
  }
  get status(): Runstatus {
    return this.state.status
  }
  get finishReason(): CompleteReason | "need-approval" | null {
    return this.state.finishReason
  }
  get error(): string | null {
    return this.state.error
  }
  get todos(): TodoItem[] {
    return this.state.todos
  }

  get isExitStatus(): boolean {
    return ["finished", "error", "paused"].includes(this.state.status)
  }

  get isRunning(): boolean {
    return this.state.status === "running"
  }
  setState(state: AgentState): void {
    this.state = {
      ...state,
      jobs: state.jobs ?? [],
      latestRunUsage: state.latestRunUsage ?? null,
    }
  }
  startRun(): void {
    this.state.status = "running"
  }
  setError(error: string | null): void {
    this.state.status = "error"
    this.state.error = error
  }
  setFinishReason(finishReason: CompleteReason | "need-approval" | null): void {
    this.state.finishReason = finishReason
  }
  setTodos(todos: TodoItem[]): void {
    this.state.todos = todos
  }
  finishRun(): void {
    this.state.status = "finished"
  }

  pauseRun(): void {
    this.state.status = "paused"
  }

  getState(): AgentState {
    return this.state
  }

  appendMessages(messages: AgentState["messages"]): void {
    this.state.messages.push(...messages)
  }

  replaceMessages(messages: AgentState["messages"]): void {
    this.state.messages = messages
  }

  recordVendor(vendor: string) {
    if (!this.vendors.includes(vendor)) this.vendors.push(vendor)
  }

  get fulfilledVendor(): string | null {
    if (this.vendors.length === 0) return null
    return this.vendors.join(", ")
  }

  get usageThisRun(): TokenUsage | null {
    return this.runUsage
  }

  incrementUsage(usage: TokenUsage) {
    this.state.usage = addUsage(this.state.usage, usage)
    this.runUsage = addUsage(this.runUsage, usage)
  }

  recordModelStepUsage(usage: TokenUsage) {
    this.incrementUsage(usage)
    if (usage.input > 0) this.state.latestRunUsage = usage
  }

  getPendingJobs() {
    return this.state.jobs.filter(
      (job) => job.status === "queued" || job.status === "running",
    )
  }

  hasPendingJobs() {
    return this.getPendingJobs().length > 0
  }

  getUnnotifiedTerminalJobs() {
    return this.state.jobs.filter(
      (job) =>
        (job.status === "completed" || job.status === "failed") &&
        job.notified !== true,
    )
  }

  markJobsNotified(jobIds: string[]) {
    const ids = new Set(jobIds)
    this.state.jobs = this.state.jobs.map((job) => {
      if (ids.has(job.jobId)) {
        return { ...job, notified: true }
      }
      return job
    })
  }

  dropNotifiedTerminalJobs() {
    this.state.jobs = this.state.jobs.filter(
      (job) =>
        !(
          (job.status === "completed" || job.status === "failed") &&
          job.notified === true
        ),
    )
  }

  updateJob(
    data: Pick<AgentJob, "jobId"> &
      Partial<Pick<AgentJob, "status" | "result" | "error" | "notified">>,
  ) {
    this.state.jobs = this.state.jobs.map((job) => {
      if (job.jobId === data.jobId) {
        return { ...job, ...data }
      }
      return job
    })
  }

  addJob(job: Omit<AgentJob, "status" | "result" | "error">) {
    this.state.jobs.push({ ...job, status: "queued" })
  }

  clearJobs() {
    this.state.jobs = []
  }

  getJob(jobId: string) {
    return this.state.jobs.find((job) => job.jobId === jobId)
  }
}
