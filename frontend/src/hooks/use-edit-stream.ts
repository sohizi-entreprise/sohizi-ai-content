import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/axios'

// ============================================================================
// TYPES
// ============================================================================

/**
 * Generic SSE event structure
 */
export type EditStreamEvent<TData = unknown> = {
  id: string
  event: string
  data: TData
}

/**
 * Configuration for the edit stream
 */
export type EditStreamConfig = {
  /** URL to POST the initial request (relative to API base) */
  requestUrl: string
  /** URL pattern for SSE stream. Use {id} as placeholder for streamId */
  streamUrl: string
  /** URL pattern for cancel endpoint (default: same as streamUrl). Use {id} as placeholder */
  cancelUrl?: string
  /** HTTP method for the initial request (default: POST) */
  method?: 'POST' | 'PUT' | 'PATCH'
  /** Event types to listen for (if not provided, listens to 'message') */
  eventTypes?: readonly string[]
  /** Pattern to detect start events (default: '_start') */
  startPattern?: string
  /** Pattern to detect end events (default: '_end') */
  endPattern?: string
  /** Pattern to detect error events (default: '_error') */
  errorPattern?: string
}

/**
 * Options for the useEditStream hook
 */
export type UseEditStreamOptions<TData = unknown> = {
  /** Called for each event received */
  onEvent?: (event: EditStreamEvent<TData>) => void
  /** Called when stream starts */
  onStart?: () => void
  /** Called when stream completes successfully */
  onComplete?: (data?: TData) => void
  /** Called on error */
  onError?: (error: Error) => void
  /** Called when stream is cancelled */
  onCancel?: () => void
}

/**
 * Return type for the useEditStream hook
 */
export type UseEditStreamReturn<TPayload> = {
  /** Start the edit stream with the given payload */
  startEdit: (payload: TPayload) => Promise<void>
  /** Cancel the current stream (also cancels on server/Redis side) */
  cancel: () => Promise<void>
  /** Whether the stream is currently active */
  isStreaming: boolean
  /** Current error if any */
  error: Error | undefined
  /** Last event ID received */
  lastEventId: string | undefined
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const defaultConfig: Partial<EditStreamConfig> = {
  method: 'POST',
  startPattern: '_start',
  endPattern: '_end',
  errorPattern: '_error',
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Generic hook for content editing streams
 * 
 * Pattern:
 * 1. Send request to endpoint with payload
 * 2. Response includes a streamId (or chatId)
 * 3. Connect to SSE stream using that ID
 * 4. Receive events until completion
 * 
 * @example
 * ```tsx
 * const { startEdit, isStreaming, cancel } = useEditStream<EditPayload, EditEvent>(
 *   {
 *     requestUrl: '/chat/edit',
 *     streamUrl: '/chat/{id}/stream',
 *     eventTypes: ['editor_start', 'editor_delta', 'editor_end', 'editor_error'],
 *   },
 *   {
 *     onEvent: (event) => console.log(event),
 *     onComplete: () => console.log('Done!'),
 *   }
 * )
 * 
 * // Start editing
 * await startEdit({ projectId: '...', content: '...', instruction: '...' })
 * ```
 */
export function useEditStream<TPayload = unknown, TData = unknown>(
  config: EditStreamConfig,
  options?: UseEditStreamOptions<TData>
): UseEditStreamReturn<TPayload> {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [lastEventId, setLastEventId] = useState<string | undefined>(undefined)

  // Merge config with defaults
  const mergedConfig = { ...defaultConfig, ...config }

  // Refs to hold mutable state
  const eventSourceRef = useRef<EventSource | null>(null)
  const optionsRef = useRef(options)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamIdRef = useRef<string | null>(null)

  // Update options ref when it changes
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  /**
   * Connect to the SSE stream
   */
  const connectToStream = useCallback((streamId: string) => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Build the SSE URL
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const streamPath = mergedConfig.streamUrl.replace('{id}', streamId)
    const sseUrl = `${baseUrl}${streamPath}`

    const eventSource = new EventSource(sseUrl)
    eventSourceRef.current = eventSource

    // Handle incoming events
    const handleEvent = (eventName: string) => (event: MessageEvent) => {
      try {
        // Parse data - may be null for start/end events
        const data = event.data ? JSON.parse(event.data) as TData : null

        const streamEvent: EditStreamEvent<TData> = {
          id: event.lastEventId,
          event: eventName,
          data: data as TData,
        }

        setLastEventId(event.lastEventId)
        optionsRef.current?.onEvent?.(streamEvent)

        // Handle lifecycle events based on patterns
        if (eventName.endsWith(mergedConfig.startPattern!)) {
          optionsRef.current?.onStart?.()
        } else if (eventName.endsWith(mergedConfig.endPattern!)) {
          setIsStreaming(false)
          streamIdRef.current = null
          eventSource.close()
          eventSourceRef.current = null
          optionsRef.current?.onComplete?.(data as TData)
        } else if (eventName.endsWith(mergedConfig.errorPattern!)) {
          const errorData = data as { message?: string; error?: string } | null
          const err = new Error(errorData?.message || errorData?.error || 'Stream error')
          setError(err)
          setIsStreaming(false)
          streamIdRef.current = null
          eventSource.close()
          eventSourceRef.current = null
          optionsRef.current?.onError?.(err)
        }
      } catch (e) {
        console.error('Failed to parse stream event:', e)
      }
    }

    // Listen to specified event types or default 'message' event
    if (mergedConfig.eventTypes && mergedConfig.eventTypes.length > 0) {
      mergedConfig.eventTypes.forEach((eventName) => {
        eventSource.addEventListener(eventName, handleEvent(eventName))
      })
    } else {
      // Default: listen to generic 'message' events
      eventSource.onmessage = handleEvent('message')
    }

    // Handle connection errors
    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        const err = new Error('Stream connection closed')
        setError(err)
        setIsStreaming(false)
        streamIdRef.current = null
        eventSourceRef.current = null
        optionsRef.current?.onError?.(err)
      }
    }
  }, [mergedConfig.streamUrl, mergedConfig.eventTypes, mergedConfig.startPattern, mergedConfig.endPattern, mergedConfig.errorPattern])

  /**
   * Start the edit stream
   */
  const startEdit = useCallback(async (payload: TPayload) => {
    // Reset state
    setError(undefined)
    setIsStreaming(true)
    setLastEventId(undefined)

    // Create abort controller for the request
    abortControllerRef.current = new AbortController()

    try {
      // Step 1: Send the initial request
      const response = await api.request({
        method: mergedConfig.method,
        url: mergedConfig.requestUrl,
        data: payload,
        signal: abortControllerRef.current.signal,
      })

      // Step 2: Extract stream ID from response
      // Support common patterns: { streamId, streamKey, chatId, id }
      const streamId = response.data?.streamId || response.data?.streamKey || response.data?.chatId || response.data?.id

      if (!streamId) {
        throw new Error('No stream ID returned from server')
      }

      // Store streamId for cancellation
      streamIdRef.current = streamId

      // Step 3: Connect to SSE stream
      connectToStream(streamId)
    } catch (e) {
      // Don't report cancelled requests as errors
      if (e instanceof Error && e.name === 'CanceledError') {
        setIsStreaming(false)
        optionsRef.current?.onCancel?.()
        return
      }

      const err = e instanceof Error ? e : new Error('Failed to start edit stream')
      setError(err)
      setIsStreaming(false)
      optionsRef.current?.onError?.(err)
    }
  }, [mergedConfig.method, mergedConfig.requestUrl, connectToStream])

  /**
   * Cancel the stream (both client-side and server-side)
   */
  const cancel = useCallback(async () => {
    // Abort the initial request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Cancel on server side (Redis)
    if (streamIdRef.current) {
      try {
        const cancelPath = (mergedConfig.cancelUrl || mergedConfig.streamUrl).replace('{id}', streamIdRef.current)
        await api.delete(cancelPath)
      } catch (err) {
        console.error('Failed to cancel stream on server:', err)
      }
      streamIdRef.current = null
    }

    // Close the EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setIsStreaming(false)
    optionsRef.current?.onCancel?.()
  }, [mergedConfig.cancelUrl, mergedConfig.streamUrl])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  return {
    startEdit,
    cancel,
    isStreaming,
    error,
    lastEventId,
  }
}
