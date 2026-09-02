import {
  CompleteReason,
  AgentState,
  Runstatus,
  TodoItem,
  TokenUsage,
} from '@/type'

export class AgentStateManager {
  private state: AgentState

  constructor(initialState?: AgentState) {
    this.state = initialState ?? {
      status: 'idle',
      error: null,
      finishReason: null,
      todos: [],
      messages: [],
      usage: null,
    }
  }
  get status(): Runstatus {
    return this.state.status
  }
  get finishReason(): CompleteReason | 'need-approval' | null {
    return this.state.finishReason
  }
  get error(): string | null {
    return this.state.error
  }
  get todos(): TodoItem[] {
    return this.state.todos
  }

  get isExitStatus(): boolean {
    return ['finished', 'error', 'paused'].includes(this.state.status)
  }

  get isRunning(): boolean {
    return this.state.status === 'running'
  }
  setState(state: AgentState): void {
    this.state = state
  }
  startRun(): void {
    this.state.status = 'running'
  }
  setError(error: string | null): void {
    this.state.status = 'error'
    this.state.error = error
  }
  setFinishReason(finishReason: CompleteReason | 'need-approval' | null): void {
    this.state.finishReason = finishReason
  }
  setTodos(todos: TodoItem[]): void {
    this.state.todos = todos
  }
  finishRun(): void {
    this.state.status = 'finished'
  }

  pauseRun(): void {
    this.state.status = 'paused'
  }

  getState(): AgentState {
    return this.state
  }

  appendMessages(messages: AgentState['messages']): void {
    this.state.messages.push(...messages)
  }

  replaceMessages(messages: AgentState['messages']): void {
    this.state.messages = messages
  }

  incrementUsage(usage: TokenUsage) {
    if (!this.state.usage) {
      this.state.usage = usage
      return
    }
    this.state.usage = {
      ...this.state.usage,
      input: this.state.usage.input + usage.input || 0,
      output: this.state.usage.output + usage.output || 0,
      reasoning: this.state.usage.reasoning + usage.reasoning || 0,
      cached: this.state.usage.cached + usage.cached || 0,
      total: this.state.usage.total + usage.total || 0,
      cost: this.state.usage.cost + usage.cost || 0,
    }
  }
}
