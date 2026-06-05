import { useMemo } from 'react'
import { useShallow } from 'zustand/shallow'
import { useChatStore } from '../store/chat-store'
import { StreamingChatBubble, insertToolResultsIntoAssistantMessages } from './chat-buble'
import { TextShimmerCss } from '@/components/ui/loaders'

export function ChatStreamingMessages() {
  const streamingMessages = useChatStore(useShallow((state) => state.streamingMessages))
  const isStreaming = useChatStore((state) => state.isStreaming)

  const messages = useMemo(
    () => insertToolResultsIntoAssistantMessages(streamingMessages),
    [streamingMessages],
  )

  if (!isStreaming && messages.length === 0) return null

  return (
    <>
      {messages.map((message) => (
        <StreamingChatBubble key={message.id} data={message} />
      ))}
      {isStreaming ? (
        <div className="sticky bottom-0 z-10 py-2 bg-background/90">
          <TextShimmerCss text="Processing..." />
        </div>
      ) : null}
    </>
  )
}
