import { useEffect, useState } from 'react'
import type { AgentRunBlock, ChatStreamChunk, Message } from '../types'
import { useGetSSE } from '@/hooks/use-get-sse'
import { useChatStore } from '../store/chat-store'
import { MediaAsset } from '@/features/media-generator/requests'

type AssistantMessage = Extract<Message, { role: 'assistant' }>
type AssistantMessageContent = AssistantMessage['content']

type Params = {
  url: string;
  initialMessages: Message[];
  onFinish: (status: AgentRunBlock['status']) => void;
  onAsset?: (asset: MediaAsset) => void;
}

export function useBufferChunks({url, initialMessages, onFinish, onAsset}: Params) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const patchConversation = useChatStore((state) => state.patchActiveConversation)

  const subscribe = useGetSSE({
    eventFuncMap: {
      chunk: (data) => {
        const chunk = (data as {chunk: ChatStreamChunk}).chunk
        setMessages((prev) => applyChunk(chunk, prev))
      },
      asset: (data) => {
        const asset = (data as {data: MediaAsset}).data
        setAssets((prev) => [...prev, asset])
        onAsset?.(asset)
      },
      done: (_, {closeEventSource}) => {
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

  return {messages, assets}
}

function applyChunk(chunk: ChatStreamChunk, messages: Message[]): Message[] {
  if (!chunk.runId) return messages

  const existingMessage = messages.find(
    (m): m is AssistantMessage => m.id === chunk.runId && m.role === 'assistant',
  )
  const message = existingMessage ?? createAssistantMessage(chunk.runId)
  const nextMessage = applyChunkToMessage(message, chunk)

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

function applyChunkToMessage(message: AssistantMessage, chunk: ChatStreamChunk): AssistantMessage {
  switch (chunk.type) {
    case 'text_delta':
      return {
        ...message,
        content: upsertTextPart(message.content, 'text', chunk.text),
      }
    case 'reasoning_delta':
      return {
        ...message,
        content: upsertTextPart(message.content, 'reasoning', chunk.text),
      }
    case 'tool_call_start':
      return {
        ...message,
        content: upsertToolCallPart(message.content, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.input,
          isStreaming: true,
        }),
      }
    case 'tool_call_delta':
      return {
        ...message,
        content: message.content.map((part) =>
          part.type === 'tool-call' && part.toolCallId === chunk.toolCallId
            ? { ...part, input: chunk.input }
            : part,
        ),
      }
    case 'tool_call_end':
      return {
        ...message,
        content: message.content.map((part) =>
          part.type === 'tool-call' && part.toolCallId === chunk.toolCallId
            ? { ...part, isStreaming: false }
            : part,
        ),
      }
    case 'usage':
      console.log('usage', chunk)
      return message
    case 'error':
      console.error('error', chunk)
      return message
    case 'abort':
      console.log('Aborted')
      return message
    case 'tool_call':
    case 'complete':
    case 'identifier':
    case 'operation':
      return message
  }
}

function upsertTextPart(
  content: AssistantMessageContent,
  type: 'text' | 'reasoning',
  text: string,
): AssistantMessageContent {
  const hasPart = content.some((part) => part.type === type)

  if (!hasPart) {
    return [...content, { type, text }]
  }

  return content.map((part) =>
    part.type === type ? { ...part, text } : part,
  )
}

function upsertToolCallPart(
  content: AssistantMessageContent,
  toolCall: {
    toolCallId: string
    toolName: string
    input: string
    isStreaming: boolean
  },
): AssistantMessageContent {
  const hasPart = content.some(
    (part) => part.type === 'tool-call' && part.toolCallId === toolCall.toolCallId,
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
