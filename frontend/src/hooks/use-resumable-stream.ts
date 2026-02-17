import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/axios'

// ============================================================================
// TYPES
// ============================================================================

export type StreamEventType = 'chunk' | 'done' | 'cancelled' | 'error'

export type StreamEvent<T = unknown> = {
  id: string
  type: StreamEventType
  data: T
}

export type UseResumableStreamOptions<T> = {
  /** Called for each event received */
  onEvent?: (event: StreamEvent<T>) => void
  /** Called when stream completes successfully */
  onComplete?: () => void
  /** Called when stream is cancelled */
  onCancel?: () => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Called when stream starts */
  onStart?: () => void
}

export type UseResumableStreamReturn = {
  /** Start the stream */
  startStream: (type: string, prompt?: string) => Promise<void>
  /** Cancel the stream */
  cancelStream: () => Promise<void>
  /** Whether the stream is currently active */
  isStreaming: boolean
  /** Current error if any */
  error: Error | undefined
  /** Last event ID received (for manual resumption) */
  lastEventId: string | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useResumableStream<T = unknown>(
  projectId: string,
  options?: UseResumableStreamOptions<T>
): UseResumableStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [lastEventId, setLastEventId] = useState<string | undefined>(undefined)

  // Refs to hold mutable state
  const eventSourceRef = useRef<EventSource | null>(null)
  const optionsRef = useRef(options)

  // Update options ref when it changes
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  /**
   * Start the stream
   */
  const startStream = useCallback(async (type: string, prompt?: string) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setError(undefined)
    setIsStreaming(true)
    setLastEventId(undefined)

    try {
      // Step 1: POST to start the stream
      await api.post('/stream/start', {
        projectId,
        type,
        prompt,
      })

      // Step 2: Connect to SSE endpoint
      const baseUrl = import.meta.env.VITE_API_BASE_URL
      const sseUrl = `${baseUrl}/stream/${projectId}`
      
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource

      optionsRef.current?.onStart?.()

      // Handle incoming events
      const handleEvent = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as { type: StreamEventType; data: T }
          const streamEvent: StreamEvent<T> = {
            id: event.lastEventId,
            type: parsed.type,
            data: parsed.data,
          }

          setLastEventId(event.lastEventId)
          optionsRef.current?.onEvent?.(streamEvent)

          // Handle terminal events
          if (parsed.type === 'done') {
            setIsStreaming(false)
            eventSource.close()
            eventSourceRef.current = null
            optionsRef.current?.onComplete?.()
          } else if (parsed.type === 'cancelled') {
            setIsStreaming(false)
            eventSource.close()
            eventSourceRef.current = null
            optionsRef.current?.onCancel?.()
          } else if (parsed.type === 'error') {
            const errorData = parsed.data as { message?: string }
            const err = new Error(errorData?.message || 'Stream error')
            setError(err)
            setIsStreaming(false)
            eventSource.close()
            eventSourceRef.current = null
            optionsRef.current?.onError?.(err)
          }
        } catch (e) {
          console.error('Failed to parse stream event:', e)
        }
      }

      // Listen to all event types
      eventSource.addEventListener('chunk', handleEvent)
      eventSource.addEventListener('done', handleEvent)
      eventSource.addEventListener('cancelled', handleEvent)
      eventSource.addEventListener('error', handleEvent)

      // Handle connection errors
      eventSource.onerror = (e) => {
        // EventSource will automatically try to reconnect
        // Only treat it as a fatal error if the connection is closed
        if (eventSource.readyState === EventSource.CLOSED) {
          const err = new Error('Stream connection closed')
          setError(err)
          setIsStreaming(false)
          eventSourceRef.current = null
          optionsRef.current?.onError?.(err)
        }
      }

    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to start stream')
      setError(err)
      setIsStreaming(false)
      optionsRef.current?.onError?.(err)
    }
  }, [projectId])

  /**
   * Cancel the stream
   */
  const cancelStream = useCallback(async () => {
    try {
      // Call the cancel endpoint
      await api.delete(`/stream/${projectId}`)
    } catch (err) {
      console.error('Failed to cancel stream:', err)
    }

    // Close the EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setIsStreaming(false)
  }, [projectId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  // Cleanup when projectId changes
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setIsStreaming(false)
      }
    }
  }, [projectId])

  return {
    startStream,
    cancelStream,
    isStreaming,
    error,
    lastEventId,
  }
}
