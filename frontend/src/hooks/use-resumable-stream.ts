import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/axios'

// ============================================================================
// TYPES
// ============================================================================

const eventTypes = [
  'error',
  // Concept generation events
  'concept_start',
  'concept_delta',
  'concept_end',
  'concept_error',
  'concept_reasoning',
  // Synopsis generation events
  'synopsis_start',
  'synopsis_delta',
  'synopsis_end',
  'synopsis_error',
  'synopsis_reasoning',
] as const;

// Backend SSE event names (the `event:` field in SSE)
export type StreamEventName = typeof eventTypes[number]

export type StreamEvent<T = unknown> = {
  id: string
  event: StreamEventName
  data: T
}

export type UseResumableStreamOptions<T> = {
  /** Called for each event received */
  onEvent?: (event: StreamEvent<T>) => void
  /** Called when stream starts (receives 'start' event) */
  onStart?: () => void
  /** Called when stream completes successfully (receives 'end' or 'complete' event) */
  onComplete?: (data?: T) => void
  /** Called on error (receives 'error' event) */
  onError?: (error: Error) => void
  /** Auto-subscribe to stream on mount (default: false) */
  autoSubscribe?: boolean
}

export type UseResumableStreamReturn = {
  /** Start the stream (POSTs to /stream/start then subscribes) */
  startStream: (type: string, prompt?: string) => Promise<void>
  /** Subscribe to an existing stream (just connects to SSE) */
  subscribe: () => void
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
   * Subscribe to an existing stream (just connects to SSE without POSTing)
   */
  const subscribe = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setError(undefined)
    setIsStreaming(true)
    setLastEventId(undefined)

    // Connect to SSE endpoint
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const sseUrl = `${baseUrl}/stream/${projectId}`
    
    const eventSource = new EventSource(sseUrl)
    eventSourceRef.current = eventSource

    // Handle incoming events
    const handleEvent = (eventName: StreamEventName) => (event: MessageEvent) => {
      try {
        // Parse data - may be null for start/end events
        const data = event.data ? JSON.parse(event.data) as T : null

        const streamEvent: StreamEvent<T> = {
          id: event.lastEventId,
          event: eventName,
          data: data as T,
        }

        setLastEventId(event.lastEventId)
        optionsRef.current?.onEvent?.(streamEvent)

        // Handle lifecycle events
        if (eventName.endsWith('_start')) {
          optionsRef.current?.onStart?.()
        } else if (eventName.endsWith('_end')) {
          setIsStreaming(false)
          eventSource.close()
          eventSourceRef.current = null
          optionsRef.current?.onComplete?.(data as T)
        } else if (eventName.endsWith('_error')) {
          //eventName === 'error' || 
          const errorData = data as { message?: string } | null
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

    // Listen to all backend event types
    eventTypes.forEach((eventName) => {
      eventSource.addEventListener(eventName, handleEvent(eventName))
    })

    // Handle connection errors
    eventSource.onerror = (_e) => {
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
  }, [projectId])

  /**
   * Start the stream (POSTs to /stream/start then subscribes)
   */
  const startStream = useCallback(async (type: string, prompt?: string) => {
    try {
      // Step 1: POST to start the stream
      await api.post('/stream/start', {
        projectId,
        type,
        prompt,
      })

      // Step 2: Subscribe to the SSE endpoint
      subscribe()
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Failed to start stream')
      setError(err)
      setIsStreaming(false)
      optionsRef.current?.onError?.(err)
    }
  }, [projectId, subscribe])

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

  // Auto-subscribe on mount if enabled
  useEffect(() => {
    if (options?.autoSubscribe) {
      subscribe()
    }
  }, [options?.autoSubscribe, subscribe])

  return {
    startStream,
    subscribe,
    cancelStream,
    isStreaming,
    error,
    lastEventId,
  }
}
