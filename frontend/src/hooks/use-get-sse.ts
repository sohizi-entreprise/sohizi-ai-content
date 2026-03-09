import { useCallback, useRef } from "react"

export type SseEventHandler= (data: unknown, options: {event: MessageEvent, closeEventSource: () => void}) => void

type GetSSEOptions<TEvent extends string> = {
    eventFuncMap: Record<TEvent, SseEventHandler>
    onError?: (error: Error) => void
  }
  
export const useGetSSE = <TEvent extends string>(params: GetSSEOptions<TEvent>) => {
  
    const { eventFuncMap, onError } = params
  
    const eventSourceRef = useRef<EventSource | null>(null)
    const eventTypesRef = useRef<Record<TEvent, SseEventHandler>>(eventFuncMap)
  
    const subscribe = useCallback((sseUrl: string) => {
      // Clean up any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      const eventSource = new EventSource(sseUrl)
      eventSourceRef.current = eventSource
  
      // Handle incoming events
      const handleEvent = (eventName: TEvent) => (event: MessageEvent) => {
        try {
          // Parse data - may be null for start/end events
          const data = event.data ? JSON.parse(event.data) : null
          const eventFunc = eventTypesRef.current[eventName]
  
          if(data){
            eventFunc(data, {
              event, 
              closeEventSource: () => {
                eventSource.close()
                eventSourceRef.current = null
              }
            })
          }
        } catch (e) {
          const err = e instanceof Error ? e : new Error('Failed to parse stream event')
          onError?.(err)
        }
      }
      Object.keys(eventTypesRef.current).forEach((eventName) => {
        eventSource.addEventListener(eventName, handleEvent(eventName as TEvent))
      })
  
      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          const err = new Error('Stream connection closed')
          eventSourceRef.current = null
          onError?.(err)
        }
      }

      return () => {
        eventSource.close()
        eventSourceRef.current = null
      }
    }, [])
  
    return subscribe
  }
  