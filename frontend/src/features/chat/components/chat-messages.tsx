import { useEffect, useRef } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatStore } from '../store/chat-store'
import { listMessagesInfiniteQueryOptions } from '../query-mutation'
import { useInfiniteQuery } from '@tanstack/react-query'
import ChatBuble from './chat-buble'
import { useShallow } from 'zustand/shallow'
import { TextShimmer } from '@/components/ui/loaders'

//
export function ChatMessages({projectId, className}: {projectId: string; className?: string}) {
  const isStreaming = useChatStore((state) => state.isStreaming)
  const conversation = useChatStore(useShallow((state) => state.activeConversation))
  const streamingMessages = useChatStore(useShallow((state) => state.streamingMessages))
  const pendingMessage = useChatStore(useShallow((state) => state.pendingMessage))
  const scrollRef = useRef<HTMLDivElement>(null)

  const conversationId = conversation?.id ?? null

  const {data: messages = [], isLoading} = useInfiniteQuery(listMessagesInfiniteQueryOptions(projectId, conversationId))

  const allMessages = mergeMessages([...messages, pendingMessage, ...streamingMessages].filter((message) => message !== null))
  const isEmpty = isLoading === false && allMessages.length === 0

  // Auto-scroll to bottom during streaming so new content is visible
  useEffect(() => {
    if (!isStreaming || !scrollRef.current) return
    const viewport = scrollRef.current
    const scrollToBottom = () => {
      viewport.scrollTop = viewport.scrollHeight
    }
    scrollToBottom()
    const raf = requestAnimationFrame(scrollToBottom)
    return () => cancelAnimationFrame(raf)
  }, [isStreaming])

  if (isLoading && allMessages.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <span className="text-sm text-muted-foreground">Loading messages...</span>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center text-muted-foreground">
          <IconSparkles className="size-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Start a conversation</p>
          <p className="text-xs mt-1">Ask me anything about your content</p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className={cn('flex-1', className)} ref={scrollRef}>
      <div className="p-4 space-y-4">
        {
          allMessages.map((message) => (
            <ChatBuble key={message.id} data={message} />
          ))
        }
        {
          isStreaming && (
            <TextShimmer text="Processing..." />
          )
        }
      </div>
    </ScrollArea>
  )
}

function mergeMessages<T extends { id: string }>(messages: T[]) {
  const seen = new Set<string>()

  return messages.filter((message) => {
    if (seen.has(message.id)) return false
    seen.add(message.id)
    return true
  })
}



