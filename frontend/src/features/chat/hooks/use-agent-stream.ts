import { useCallback, useRef, useState } from 'react'
import type {
  AgentState,
  AgentEvent,
  AgentToolCall,
  AgentToolResult,
  WriterProgress,
  WriterComplete,
  SubAgentProgress,
  SubAgentComplete,
  ScriptContent,
  ProjectInfo,
} from '../types'

// ============================================================================
// TYPES
// ============================================================================

export type AgentStreamInput = {
  projectId: string
  conversationId: string
  message: string
  script?: ScriptContent
  project?: ProjectInfo
  selection?: {
    text: string
    blockId?: string
    range?: { from: number; to: number }
  }
  model?: string
  maxIterations?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
}

export type AgentStreamCallbacks = {
  onReasoningDelta?: (text: string) => void
  onContentDelta?: (text: string) => void
  onToolCall?: (tool: AgentToolCall) => void
  onToolResult?: (result: AgentToolResult) => void
  onWriterProgress?: (progress: WriterProgress) => void
  onWriterComplete?: (complete: WriterComplete) => void
  onSubAgentProgress?: (progress: SubAgentProgress) => void
  onSubAgentComplete?: (complete: SubAgentComplete) => void
  onComplete?: (response: string) => void
  onError?: (error: string) => void
}

export type UseAgentStreamReturn = {
  state: AgentState
  startStream: (input: AgentStreamInput, callbacks?: AgentStreamCallbacks) => Promise<string>
  abortStream: () => void
  isStreaming: boolean
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AgentState = {
  isRunning: false,
  runId: null,
  reasoning: '',
  currentTool: null,
  toolResults: [],
  writerProgress: null,
  subAgentProgress: null,
  error: null,
}

// ============================================================================
// HOOK
// ============================================================================

export function useAgentStream(): UseAgentStreamReturn {
  const [state, setState] = useState<AgentState>(initialState)
  const abortControllerRef = useRef<AbortController | null>(null)
  const responseRef = useRef<string>('')

  /**
   * Abort the current stream
   */
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState((prev) => ({ ...prev, isRunning: false }))
  }, [])

  /**
   * Start streaming from the agent endpoint
   */
  const startStream = useCallback(
    async (input: AgentStreamInput, callbacks?: AgentStreamCallbacks): Promise<string> => {
      // Abort any existing stream
      abortStream()

      // Create new abort controller
      abortControllerRef.current = new AbortController()
      responseRef.current = ''

      // Reset state
      setState({
        ...initialState,
        isRunning: true,
      })

      try {
        const response = await fetch('/api/ai/editor/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Process the SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE events
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('event:')) {
              const eventType = line.slice(6).trim()
              continue
            }

            if (line.startsWith('data:')) {
              const dataStr = line.slice(5).trim()
              if (dataStr === 'null' || dataStr === '') continue

              try {
                const data = JSON.parse(dataStr)
                processEvent(eventType, data, callbacks, setState, responseRef)
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }

        setState((prev) => ({ ...prev, isRunning: false }))
        return responseRef.current
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // Stream was aborted
          return responseRef.current
        }

        const errorMessage = error instanceof Error ? error.message : String(error)
        setState((prev) => ({
          ...prev,
          isRunning: false,
          error: errorMessage,
        }))
        callbacks?.onError?.(errorMessage)
        throw error
      }
    },
    [abortStream]
  )

  return {
    state,
    startStream,
    abortStream,
    isStreaming: state.isRunning,
  }
}

// ============================================================================
// EVENT PROCESSOR
// ============================================================================

let eventType = ''

function processEvent(
  type: string,
  data: unknown,
  callbacks: AgentStreamCallbacks | undefined,
  setState: React.Dispatch<React.SetStateAction<AgentState>>,
  responseRef: React.MutableRefObject<string>
): void {
  // Update event type for next data line
  if (type) {
    eventType = type
    return
  }

  const eventData = data as Record<string, unknown>

  switch (eventType) {
    case 'start':
      setState((prev) => ({
        ...prev,
        runId: (eventData.runId as string) || null,
      }))
      break

    case 'reasoning_delta':
      const reasoningText = (eventData.text as string) || ''
      setState((prev) => ({
        ...prev,
        reasoning: prev.reasoning + reasoningText,
      }))
      callbacks?.onReasoningDelta?.(reasoningText)
      break

    case 'content_delta':
      const contentText = (eventData.text as string) || ''
      responseRef.current += contentText
      callbacks?.onContentDelta?.(contentText)
      break

    case 'tool_call':
      const toolCall: AgentToolCall = {
        toolName: (eventData.toolName as string) || '',
        toolId: (eventData.toolId as string) || '',
        args: eventData.args,
      }
      setState((prev) => ({
        ...prev,
        currentTool: toolCall,
      }))
      callbacks?.onToolCall?.(toolCall)
      break

    case 'tool_result':
      const toolResult: AgentToolResult = {
        toolName: (eventData.toolName as string) || '',
        toolId: (eventData.toolId as string) || '',
        result: eventData.result,
        success: Boolean(eventData.success),
      }
      setState((prev) => ({
        ...prev,
        currentTool: null,
        toolResults: [...prev.toolResults, toolResult],
      }))
      callbacks?.onToolResult?.(toolResult)
      break

    case 'writer_start':
    case 'writer_progress':
      const writerProgress: WriterProgress = {
        taskId: (eventData.taskId as string) || '',
        phase: (eventData.phase as 'writing' | 'reviewing' | 'revising') || 'writing',
        content: eventData.content as string | undefined,
        revisionCount: eventData.revisionCount as number | undefined,
      }
      setState((prev) => ({
        ...prev,
        writerProgress,
      }))
      callbacks?.onWriterProgress?.(writerProgress)
      break

    case 'writer_complete':
      const writerComplete: WriterComplete = {
        taskId: (eventData.taskId as string) || '',
        success: Boolean(eventData.success),
        content: (eventData.content as string) || '',
        reviewNotes: (eventData.reviewNotes as string) || '',
        revisionCount: (eventData.revisionCount as number) || 0,
      }
      setState((prev) => ({
        ...prev,
        writerProgress: null,
      }))
      callbacks?.onWriterComplete?.(writerComplete)
      break

    case 'sub_agent_start':
    case 'sub_agent_progress':
      const subAgentProgress: SubAgentProgress = {
        taskId: (eventData.taskId as string) || '',
        phase: (eventData.phase as string) || '',
        content: eventData.content as string | undefined,
      }
      setState((prev) => ({
        ...prev,
        subAgentProgress,
      }))
      callbacks?.onSubAgentProgress?.(subAgentProgress)
      break

    case 'sub_agent_complete':
      const subAgentComplete: SubAgentComplete = {
        taskId: (eventData.taskId as string) || '',
        success: Boolean(eventData.success),
        output: eventData.output,
      }
      setState((prev) => ({
        ...prev,
        subAgentProgress: null,
      }))
      callbacks?.onSubAgentComplete?.(subAgentComplete)
      break

    case 'error':
      const errorMessage = (eventData.message as string) || 'Unknown error'
      setState((prev) => ({
        ...prev,
        error: errorMessage,
      }))
      callbacks?.onError?.(errorMessage)
      break

    case 'complete':
      const response = (eventData.response as string) || responseRef.current
      responseRef.current = response
      callbacks?.onComplete?.(response)
      break

    case 'end':
      setState((prev) => ({
        ...prev,
        isRunning: false,
      }))
      break
  }
}
