import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type MediaGenerationEvent = {
  requestId: string
  type: string
  data: unknown
}

export type ActiveMediaRequest = {
  requestId: string
  events: MediaGenerationEvent[]
  status: 'streaming' | 'completed' | 'error'
  error?: string
}

type MediaGenerationStreamState = {
  activeRequests: Record<string, ActiveMediaRequest>
}

type MediaGenerationStreamActions = {
  startRequest: (requestId: string) => void
  appendEvent: (requestId: string, event: MediaGenerationEvent) => void
  completeRequest: (requestId: string) => void
  errorRequest: (requestId: string, error: string) => void
  removeRequest: (requestId: string) => void
}

const initialState: MediaGenerationStreamState = {
  activeRequests: {},
}

export const useMediaGenerationStreamStore = create<
  MediaGenerationStreamState & MediaGenerationStreamActions
>()(
  immer((set) => ({
    ...initialState,
    startRequest: (requestId) =>
      set((state) => {
        state.activeRequests[requestId] = {
          requestId,
          events: [],
          status: 'streaming',
        }
      }),
    appendEvent: (requestId, event) =>
      set((state) => {
        const request = state.activeRequests[requestId]
        if (!request) {
          state.activeRequests[requestId] = {
            requestId,
            events: [event],
            status: 'streaming',
          }
          return
        }
        request.events.push(event)
      }),
    completeRequest: (requestId) =>
      set((state) => {
        const request = state.activeRequests[requestId]
        if (request) {
          request.status = 'completed'
        }
      }),
    errorRequest: (requestId, error) =>
      set((state) => {
        const request = state.activeRequests[requestId]
        if (request) {
          request.status = 'error'
          request.error = error
        }
      }),
    removeRequest: (requestId) =>
      set((state) => {
        delete state.activeRequests[requestId]
      }),
  })),
)
