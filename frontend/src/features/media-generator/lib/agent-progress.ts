import type { Message } from '@/features/chat'

type SubmitMediaJobsInput = {
  jobs: Record<string, string>[]
  status: 'done' | 'blocked'
  message: string
}

export function extractLastMessageContent(messages: Message[], isLoading = false) {
  let submitMediaJobsMessage: string | undefined
  let textContent: string | undefined
  let hasStreamingReasoning = false
  let streamingToolName: string | undefined

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== 'assistant') continue

    for (const part of message.content) {
      switch (part.type) {
        case 'text':
          if (part.text) textContent = part.text
          break
        case 'reasoning':
          if (part.isStreaming) hasStreamingReasoning = true
          break
        case 'tool-call': {
          if (part.toolName === 'submitMediaJobs') {
            const input = part.input as Partial<SubmitMediaJobsInput>
            if (typeof input.message === 'string' && input.message.trim()) {
              submitMediaJobsMessage = input.message
            }
          }
          if (part.isStreaming) {
            streamingToolName = part.toolName
          }
          break
        }
      }
    }

    break
  }

  if (submitMediaJobsMessage) return submitMediaJobsMessage
  if (textContent) {
    const trimmed = textContent.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return isLoading ? 'Preparing generation...' : textContent
    }
    return textContent
  }
  if (hasStreamingReasoning) return 'Thinking ...'
  if (streamingToolName) {
    return `Calling tool ${streamingToolName}...`
  }
  return isLoading ? 'Processing ...' : ''
}
