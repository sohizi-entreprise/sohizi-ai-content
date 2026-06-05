import type { ChatStreamChunk, Message, MsgToolCallPart } from '../types'

export function applyChunkToStreamingMessages(
  streamingMessages: Message[],
  chunk: ChatStreamChunk,
) {
  if (!chunk.runId) return

  let message = streamingMessages.find((m) => m.id === chunk.runId)
  if (!message) {
    message = {
      id: chunk.runId,
      role: 'assistant',
      content: [],
      createdAt: new Date().toISOString(),
    }
    streamingMessages.push(message)
  }

  switch (chunk.type) {
    case 'text_delta': {
      const textPart = message.content.find((part) => part.type === 'text')
      if (textPart && textPart.type === 'text') {
        textPart.text += chunk.text
      } else {
        message.content.push({ type: 'text', text: chunk.text })
      }
      break
    }
    case 'reasoning_delta': {
      const reasoningPart = message.content.find((part) => part.type === 'reasoning')
      if (reasoningPart && reasoningPart.type === 'reasoning') {
        reasoningPart.text += chunk.text
      } else {
        message.content.push({ type: 'reasoning', text: chunk.text })
      }
      break
    }
    case 'usage':
      console.log('usage', chunk)
      break
    case 'tool_call_start': {
      const toolCallPart = message.content.find(
        (part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId,
      ) as MsgToolCallPart | undefined
      if (toolCallPart) {
        toolCallPart.input = `${toolCallPart.input ?? ''}${chunk.input}`
      } else {
        message.content.push({
          type: 'tool-call',
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.input,
          isStreaming: true,
        })
      }
      break
    }
    case 'tool_call_delta': {
      const toolCallPart = message.content.find(
        (part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId,
      ) as MsgToolCallPart | undefined
      if (toolCallPart) {
        toolCallPart.input = `${toolCallPart.input ?? ''}${chunk.input}`
      }
      break
    }
    case 'tool_call_end': {
      const toolCallPart = message.content.find(
        (part) => part.type === 'tool-call' && part.toolCallId === chunk.toolCallId,
      ) as MsgToolCallPart | undefined
      if (toolCallPart) {
        toolCallPart.isStreaming = false
      }
      break
    }
    case 'tool_call':
    case 'complete':
    case 'identifier':
      break
    case 'error':
      console.error('error', chunk)
      break
    case 'abort':
      console.log('Aborted')
      break
  }
}
