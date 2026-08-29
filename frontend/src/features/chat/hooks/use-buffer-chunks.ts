import { useEffect, useState } from 'react'
import { parse } from 'partial-json'
import { useChatStore } from '../store/chat-store'
import type {
  AgentRunBlock,
  ChatStreamChunk,
  FilePendingOperation,
  Message,
} from '../types'
import type { MediaAsset } from '@/features/media-generator/requests'
import { useGetSSE } from '@/hooks/use-get-sse'

type AssistantMessage = Extract<Message, { role: 'assistant' }>
type AssistantMessageContent = AssistantMessage['content']

type Params = {
  url: string
  initialMessages: Array<Message>
  onFinish: (status: AgentRunBlock['status']) => void
  onAsset?: (asset: MediaAsset) => void
  onOperation?: (operation: FilePendingOperation) => void
}

export function useBufferChunks({
  url,
  initialMessages,
  onFinish,
  onAsset,
  onOperation,
}: Params) {
  const [messages, setMessages] = useState<Array<Message>>(initialMessages)
  const [assets, setAssets] = useState<Array<MediaAsset>>([])
  const patchConversation = useChatStore(
    (state) => state.patchActiveConversation,
  )

  const subscribe = useGetSSE({
    eventFuncMap: {
      chunk: (data) => {
        const chunk = (data as { chunk: ChatStreamChunk }).chunk
        setMessages((prev) => applyChunk(chunk, prev, onOperation))
      },
      asset: (data) => {
        const asset = (data as { data: MediaAsset }).data
        setAssets((prev) => [...prev, asset])
        onAsset?.(asset)
      },
      done: (_, { closeEventSource }) => {
        onFinish('finished')
        closeEventSource()
        patchConversation({ isStreaming: false })
      },
    },
  })

  useEffect(() => {
    const unsubscribe = subscribe(url)

    return () => unsubscribe()
  }, [url, subscribe])

  return { messages, assets }
}

function applyChunk(
  chunk: ChatStreamChunk,
  messages: Array<Message>,
  onOperation?: (operation: FilePendingOperation) => void,
): Array<Message> {
  if (!chunk.runId) return messages

  const existingMessage = messages.find(
    (m): m is AssistantMessage =>
      m.id === chunk.runId && m.role === 'assistant',
  )
  const message = existingMessage ?? createAssistantMessage(chunk.runId)
  const nextMessage = applyChunkToMessage(message, chunk, onOperation)

  if (!existingMessage) {
    return [...messages, nextMessage]
  }

  if (nextMessage === existingMessage) {
    return messages
  }

  return messages.map((m) => (m.id === nextMessage.id ? nextMessage : m))
}

function createAssistantMessage(runId: string): AssistantMessage {
  return {
    id: runId,
    role: 'assistant',
    content: [],
    createdAt: new Date().toISOString(),
  }
}

function applyChunkToMessage(
  message: AssistantMessage,
  chunk: ChatStreamChunk,
  onOperation?: (operation: FilePendingOperation) => void,
): AssistantMessage {
  const currentMessage =
    chunk.type === 'reasoning_delta' ? message : finishReasoning(message)

  switch (chunk.type) {
    case 'text_delta':
      return {
        ...currentMessage,
        content: upsertTextPart(currentMessage.content, 'text', chunk.text),
      }
    case 'reasoning_delta':
      return {
        ...currentMessage,
        content: upsertTextPart(
          currentMessage.content,
          'reasoning',
          chunk.text,
          true,
        ),
      }
    case 'tool_call_start':
      return {
        ...currentMessage,
        content: upsertToolCallPart(currentMessage.content, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: {},
          isStreaming: true,
        }),
      }
    case 'tool_call_delta':
      return {
        ...currentMessage,
        content: currentMessage.content.map((part) => {
          if (
            part.type !== 'tool-call' ||
            part.toolCallId !== chunk.toolCallId
          ) {
            return part
          }
          if (!chunk.input.trim()) {
            return part
          }
          try {
            return { ...part, input: parse(chunk.input) }
          } catch {
            // Partial JSON not yet parseable; keep previous input
            return part
          }
        }),
      }
    // case 'tool_call_end':
    //   return {
    //     ...message,
    //     content: message.content.map((part) =>
    //       part.type === 'tool-call' && part.toolCallId === chunk.toolCallId
    //         ? { ...part, isStreaming: false }
    //         : part,
    //     ),
    //   }
    case 'tool_call':
      return {
        ...currentMessage,
        content: upsertToolCallPart(currentMessage.content, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.input as Record<string, unknown>,
          isStreaming: false,
        }),
      }
    case 'tool_result_complete':
      return {
        ...currentMessage,
        content: [
          ...currentMessage.content.map((part) =>
            part.type === 'tool-call' && part.toolCallId === chunk.toolCallId
              ? { ...part, isStreaming: false }
              : part,
          ),
          {
            type: 'tool-result' as const,
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            output: {
              type: chunk.success ? 'text' : 'error-text',
              value: chunk.output,
            },
          },
        ],
      }
    case 'usage':
      console.log('usage', chunk)
      return currentMessage
    case 'error':
      console.error('error', chunk)
      return currentMessage
    case 'abort':
      console.log('Aborted')
      return currentMessage
    case 'operation':
      onOperation?.(chunk.operation)
      return currentMessage
    case 'complete':
    case 'identifier':
      return currentMessage
    default:
      return currentMessage
  }
}

function upsertTextPart(
  content: AssistantMessageContent,
  type: 'text' | 'reasoning',
  text: string,
  isStreaming?: boolean,
): AssistantMessageContent {
  const hasPart = content.some((part) => part.type === type)

  if (!hasPart) {
    return [...content, { type, text, isStreaming }]
  }

  return content.map((part) =>
    part.type === type ? { ...part, text, isStreaming } : part,
  )
}

function finishReasoning(message: AssistantMessage): AssistantMessage {
  const hasStreamingReasoning = message.content.some(
    (part) => part.type === 'reasoning' && part.isStreaming,
  )

  if (!hasStreamingReasoning) return message

  return {
    ...message,
    content: message.content.map((part) =>
      part.type === 'reasoning' ? { ...part, isStreaming: false } : part,
    ),
  }
}

function upsertToolCallPart(
  content: AssistantMessageContent,
  toolCall: {
    toolCallId: string
    toolName: string
    input: Record<string, unknown>
    isStreaming: boolean
  },
): AssistantMessageContent {
  const hasPart = content.some(
    (part) =>
      part.type === 'tool-call' && part.toolCallId === toolCall.toolCallId,
  )

  if (!hasPart) {
    return [...content, { type: 'tool-call', ...toolCall }]
  }

  return content.map((part) =>
    part.type === 'tool-call' && part.toolCallId === toolCall.toolCallId
      ? { ...part, input: toolCall.input, isStreaming: toolCall.isStreaming }
      : part,
  )
}
