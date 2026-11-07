import { useEffect, useRef, useState } from "react"
import { parse } from "partial-json"
import { useChatStore } from "../store/chat-store"
import type {
  AgentRunBlock,
  ChatStreamChunk,
  FilePendingOperation,
  Message,
  VideoEditorChange,
} from "../types"
import type { MediaAsset } from "@/features/media-generator/requests"
import { useGetSSE } from "@/hooks/use-get-sse"

type AssistantMessage = Extract<Message, { role: "assistant" }>
type AssistantMessageContent = AssistantMessage["content"]

type Params = {
  url: string
  initialMessages: Array<Message>
  isCancelled?: boolean
  onFinish: (status: AgentRunBlock["status"], error?: string | null) => void
  onAsset?: (asset: MediaAsset) => void
  onOperation?: (operation: FilePendingOperation) => void
  onVideoEditorChange?: (change: VideoEditorChange) => void
  onTitleUpdate?: (conversationId: string, title: string) => void
  onError?: (error: Error) => void
}

export function useBufferChunks({
  url,
  initialMessages,
  isCancelled = false,
  onFinish,
  onAsset,
  onOperation,
  onVideoEditorChange,
  onTitleUpdate,
  onError,
}: Params) {
  const [messages, setMessages] = useState<Array<Message>>(initialMessages)
  const [assets, setAssets] = useState<Array<MediaAsset>>([])
  const [error, setError] = useState<string | null>(null)
  const streamErrorRef = useRef<string | null>(null)
  const finishedRef = useRef(false)
  const abortedRef = useRef(isCancelled)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const patchConversation = useChatStore(
    (state) => state.patchActiveConversation,
  )

  abortedRef.current = abortedRef.current || isCancelled

  const clearStreamError = () => {
    streamErrorRef.current = null
    setError(null)
  }

  const recordStreamError = (errorMessage: string) => {
    if (abortedRef.current) return
    streamErrorRef.current = errorMessage
    setError(errorMessage)
    setMessages((prev) => stopStreamingParts(prev))
  }

  const subscribe = useGetSSE({
    eventFuncMap: {
      chunk: (data) => {
        const payload = data as {
          chunk?: ChatStreamChunk
          source?: "subAgent"
        }
        const chunk = payload.chunk
        if (!chunk) return
        if (payload.source === "subAgent") {
          chunk.source = "subAgent"
        }
        if (chunk.type === "usage" && chunk.source !== "subAgent") {
          patchConversation({
            metadata: {
              usage: chunk.usage,
              latestRunUsage: chunk.latestRunUsage ?? null,
            },
          })
        }
        if (chunk.source !== "subAgent") {
          if (
            chunk.type === "abort" ||
            (chunk.type === "complete" &&
              (chunk.finishReason === "abort" ||
                chunk.finishReason === "aborted"))
          ) {
            abortedRef.current = true
            clearStreamError()
            setMessages((prev) => stopStreamingParts(prev))
          } else if (chunk.type === "error") {
            recordStreamError(chunk.error)
          } else if (
            chunk.type === "complete" &&
            chunk.finishReason === "error"
          ) {
            recordStreamError(chunk.error || "Unknown agent error")
          }
        }
        setMessages((prev) =>
          applyChunk(chunk, prev, onOperation, onVideoEditorChange),
        )
      },
      asset: (data) => {
        const asset = (data as { data: MediaAsset }).data
        setAssets((prev) => [...prev, asset])
        onAsset?.(asset)
      },
      title: (data) => {
        const { conversationId, title } = data as {
          conversationId?: string
          title?: string
        }
        if (!title) return
        const activeId = useChatStore.getState().activeConversation?.id
        if (!conversationId || activeId === conversationId) {
          patchConversation({ title })
        }
        if (conversationId) {
          onTitleUpdate?.(conversationId, title)
        }
      },
      done: (data, { closeEventSource }) => {
        finishedRef.current = true
        setMessages((prev) => stopStreamingParts(prev))
        const doneError =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : null
        if (doneError) {
          recordStreamError(doneError)
        }
        const finalError = abortedRef.current
          ? null
          : (doneError ?? streamErrorRef.current)
        const finalStatus = finalError ? "error" : "finished"
        onFinish(finalStatus, finalError)
        closeEventSource()
        patchConversation({ isStreaming: false, activeRunId: null })
      },
    },
    onError: (err) => {
      if (!finishedRef.current && !abortedRef.current) {
        const errorMessage = streamErrorRef.current ?? err.message
        recordStreamError(errorMessage)
        onFinish("error", errorMessage)
        patchConversation({ isStreaming: false, activeRunId: null })
      }
      onError?.(err)
    },
  })

  useEffect(() => {
    if (isCancelled) {
      abortedRef.current = true
      finishedRef.current = true
      clearStreamError()
      setMessages((prev) => stopStreamingParts(prev))
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
      onFinish("finished", null)
      return
    }
    finishedRef.current = false
    const unsubscribe = subscribe(url)
    unsubscribeRef.current = unsubscribe

    return () => {
      unsubscribe()
      unsubscribeRef.current = null
    }
  }, [url, subscribe, isCancelled])

  return { messages, assets, error: isCancelled ? null : error }
}

function applyChunk(
  chunk: ChatStreamChunk,
  messages: Array<Message>,
  onOperation?: (operation: FilePendingOperation) => void,
  onVideoEditorChange?: (change: VideoEditorChange) => void,
): Array<Message> {
  if (chunk.source === "subAgent") {
    return applySubAgentChunkToMessages(chunk, messages)
  }

  if (!chunk.runId) return messages

  const existingMessage = messages.find(
    (m): m is AssistantMessage =>
      m.id === chunk.runId && m.role === "assistant",
  )
  const message = existingMessage ?? createAssistantMessage(chunk.runId)
  const nextMessage = applyChunkToMessage(
    message,
    chunk,
    onOperation,
    onVideoEditorChange,
  )

  if (!existingMessage) {
    return [...messages, nextMessage]
  }

  if (nextMessage === existingMessage) {
    return messages
  }

  return messages.map((m) => (m.id === nextMessage.id ? nextMessage : m))
}

function applySubAgentChunkToMessages(
  chunk: ChatStreamChunk,
  messages: Array<Message>,
): Array<Message> {
  const toolCallId = "toolCallId" in chunk ? chunk.toolCallId : undefined
  const messageIndex = messages.findIndex((m): m is AssistantMessage => {
    if (m.role !== "assistant") return false
    return m.content.some(
      (part) =>
        part.type === "tool-call" &&
        (part.toolCallId === toolCallId ||
          (part.toolName === "assignTask" && part.isStreaming)),
    )
  })
  if (messageIndex === -1) return messages

  const message = messages[messageIndex]
  if (message.role !== "assistant") return messages

  const nextMessage = applySubAgentChunk(message, chunk)
  if (nextMessage === message) return messages

  return messages.map((m) => (m.id === nextMessage.id ? nextMessage : m))
}

function createAssistantMessage(runId: string): AssistantMessage {
  return {
    id: runId,
    role: "assistant",
    content: [],
    createdAt: new Date().toISOString(),
  }
}

const HIDDEN_SUB_AGENT_TOOLS = new Set([
  "endExecutionLoop",
  "finish",
  "provideStatusUpdate",
])

function applyChunkToMessage(
  message: AssistantMessage,
  chunk: ChatStreamChunk,
  onOperation?: (operation: FilePendingOperation) => void,
  onVideoEditorChange?: (change: VideoEditorChange) => void,
): AssistantMessage {
  const currentMessage =
    chunk.type === "reasoning_delta" ? message : finishReasoning(message)

  switch (chunk.type) {
    case "text_delta":
      return {
        ...currentMessage,
        content: upsertTextPart(currentMessage.content, "text", chunk.text),
      }
    case "progress_update":
      return {
        ...currentMessage,
        content: upsertToolCallPart(currentMessage.content, {
          toolCallId: chunk.toolCallId,
          toolName: "provideStatusUpdate",
          input: { message: chunk.text },
          isStreaming: true,
        }),
      }
    case "context_compaction":
      return {
        ...currentMessage,
        content: upsertToolCallPart(currentMessage.content, {
          toolCallId: chunk.compactionId,
          toolName: "contextCompaction",
          input: { status: chunk.status },
          isStreaming: chunk.status === "started",
        }),
      }
    case "reasoning_delta":
      return {
        ...currentMessage,
        content: upsertTextPart(
          currentMessage.content,
          "reasoning",
          chunk.text,
          true,
        ),
      }
    case "tool_call_start":
      return {
        ...currentMessage,
        content: upsertToolCallPart(currentMessage.content, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: {},
          isStreaming: true,
        }),
      }
    case "tool_call_delta":
      return {
        ...currentMessage,
        content: currentMessage.content.map((part) => {
          if (
            part.type !== "tool-call" ||
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
    case "tool_call":
      return {
        ...currentMessage,
        content: upsertToolCallPart(currentMessage.content, {
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
          input: chunk.input as Record<string, unknown>,
          isStreaming: true,
        }),
      }
    case "tool_result_complete":
      return {
        ...currentMessage,
        content: [
          ...currentMessage.content.map((part) => {
            if (
              part.type === "tool-call" &&
              part.toolCallId === chunk.toolCallId
            ) {
              return {
                ...part,
                isStreaming: false,
                currentSubToolName: undefined,
              }
            }
            if (
              chunk.toolName === "provideStatusUpdate" &&
              part.type === "text"
            ) {
              return { ...part, isStreaming: false }
            }
            return part
          }),
          {
            type: "tool-result" as const,
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            output: {
              type: chunk.success ? "text" : "error-text",
              value: chunk.output,
            },
          },
        ],
      }
    case "usage":
      return currentMessage
    case "error":
      console.error("error", chunk)
      return currentMessage
    case "abort":
      console.log("Aborted")
      return currentMessage
    case "operation":
      onOperation?.(chunk.operation)
      return currentMessage
    case "video_editor_change":
      onVideoEditorChange?.(chunk.change)
      return currentMessage
    case "complete":
    case "identifier":
      return currentMessage
    default:
      return currentMessage
  }
}

function applySubAgentChunk(
  message: AssistantMessage,
  chunk: ChatStreamChunk,
): AssistantMessage {
  if (chunk.type !== "tool_call" && chunk.type !== "tool_call_start") {
    return message
  }

  if (HIDDEN_SUB_AGENT_TOOLS.has(chunk.toolName)) {
    return message
  }

  const index = message.content.findIndex(
    (part) => part.type === "tool-call" && part.toolCallId === chunk.toolCallId,
  )
  const parentIndex =
    index === -1
      ? message.content.findIndex(
          (part) =>
            part.type === "tool-call" &&
            part.toolName === "assignTask" &&
            part.isStreaming,
        )
      : index
  if (parentIndex === -1) return message

  const part = message.content[parentIndex]
  if (part.type !== "tool-call") return message

  const content = message.content.slice()
  content[parentIndex] = { ...part, currentSubToolName: chunk.toolName }
  return { ...message, content }
}

function upsertTextPart(
  content: AssistantMessageContent,
  type: "text" | "reasoning",
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

function stopStreamingParts(messages: Array<Message>): Array<Message> {
  return messages.map((message) => {
    switch (message.role) {
      case "user":
        return {
          ...message,
          content: message.content.map((part) =>
            part.type === "text" && part.isStreaming
              ? { ...part, isStreaming: false }
              : part,
          ),
        }
      case "assistant":
        return {
          ...message,
          content: message.content.map((part) =>
            "isStreaming" in part && part.isStreaming
              ? { ...part, isStreaming: false }
              : part,
          ),
        }
      case "tool":
        return {
          ...message,
          content: message.content.map((part) =>
            part.isStreaming ? { ...part, isStreaming: false } : part,
          ),
        }
    }
  })
}

function finishReasoning(message: AssistantMessage): AssistantMessage {
  const hasStreamingReasoning = message.content.some(
    (part) => part.type === "reasoning" && part.isStreaming,
  )

  if (!hasStreamingReasoning) return message

  return {
    ...message,
    content: message.content.map((part) =>
      part.type === "reasoning" ? { ...part, isStreaming: false } : part,
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
      part.type === "tool-call" && part.toolCallId === toolCall.toolCallId,
  )

  if (!hasPart) {
    return [...content, { type: "tool-call", ...toolCall }]
  }

  return content.map((part) =>
    part.type === "tool-call" && part.toolCallId === toolCall.toolCallId
      ? { ...part, input: toolCall.input, isStreaming: toolCall.isStreaming }
      : part,
  )
}
