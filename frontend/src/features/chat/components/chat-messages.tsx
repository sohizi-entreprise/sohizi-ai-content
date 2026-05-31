import { useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { IconSparkles, IconLoader2 } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import { listMessagesInfiniteQueryOptions } from '../query-mutation'
import { useInfiniteQuery } from '@tanstack/react-query'
import ChatBuble, { insertToolResultsIntoAssistantMessages } from './chat-buble'
import { useShallow } from 'zustand/shallow'
import { TextShimmer } from '@/components/ui/loaders'
import { useAutoScroll } from '@/hooks/use-auto-scroll'

export function ChatMessages({projectId, className}: {projectId: string; className?: string}) {
  const isStreaming = useChatStore((state) => state.isStreaming)
  const conversation = useChatStore(useShallow((state) => state.activeConversation))
  const streamingMessages = useChatStore(useShallow((state) => state.streamingMessages))
  const pendingMessage = useChatStore(useShallow((state) => state.pendingMessage))
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)

  const conversationId = conversation?.id ?? null

  const {
    data: messages = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(listMessagesInfiniteQueryOptions(projectId, conversationId))

  useAutoScroll({
    scrollRef,
    isStreaming,
    scrollOnMount: true,
  })

  // Scroll to bottom when the user sends a new message (pendingMessage appears)
  useEffect(() => {
    if (pendingMessage && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [pendingMessage])

  // Scroll to bottom when messages first load
  useEffect(() => {
    if (!isLoading && messages.length > 0 && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      })
    }
  }, [isLoading, conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preserve scroll position when older messages are prepended
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || prevScrollHeightRef.current === 0) return

    const diff = el.scrollHeight - prevScrollHeightRef.current
    if (diff > 0) {
      el.scrollTop += diff
    }
    prevScrollHeightRef.current = 0
  }, [messages])

  // IntersectionObserver on sentinel to trigger fetching older messages
  const handleFetchOlder = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    const el = scrollRef.current
    if (el) {
      prevScrollHeightRef.current = el.scrollHeight
    }
    fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    const viewport = scrollRef.current
    if (!sentinel || !viewport) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleFetchOlder()
        }
      },
      { root: viewport, rootMargin: '100px 0px 0px 0px', threshold: 0 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleFetchOlder])

  const allMessages = insertToolResultsIntoAssistantMessages(
    mergeMessages([...messages, pendingMessage, ...streamingMessages].filter((message) => message !== null))
  )
  const isEmpty = isLoading === false && allMessages.length === 0

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
    <div className={cn('flex-1 overflow-y-auto w-full', className)} ref={scrollRef}>
      <div className="p-4 space-y-4">
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {allMessages.map((message) => (
          <ChatBuble key={message.id} data={message} />
        ))}
        {isStreaming && (
          <TextShimmer text="Processing..." />
        )}
      </div>
    </div>
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
