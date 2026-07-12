import { useEffect, useRef, useCallback } from 'react'
import { IconSparkles, IconLoader2 } from '@tabler/icons-react'
import { StoreConversation, useChatStore } from '../store/chat-store'
import { listAgentRunsInfiniteQueryOptions } from '../query-mutation'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/shallow'
import { ChatRunBlock } from './chat-run-block'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'

export function ChatMessages({ projectId, className }: { projectId: string; className?: string }) {
  const conversation = useChatStore(useShallow((state) => state.activeConversation))

  if (!conversation) {
    return <RenderEmpty />
  }

  return <RenderAgentRuns conversation={conversation} projectId={projectId} className={className} />
}


function RenderAgentRuns(props: { conversation: StoreConversation; projectId: string; className?: string }) {
  const { conversation, projectId, className } = props
  const sentinelRef = useRef<HTMLDivElement>(null)

  const isNew = conversation.isNew ?? true

  const {
    data: runs = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(listAgentRunsInfiniteQueryOptions(projectId, conversation.id, isNew))

  const handleFetchOlder = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return
    fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleFetchOlder()
        }
      },
      { rootMargin: '100px 0px 0px 0px', threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleFetchOlder])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading messages...</span>
      </div>
    )
  }

  if (runs.length === 0) {
    return <RenderEmpty />
  }

  return (
    <Conversation className={className}>
      <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-6">
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {runs.map((run) => (
          <ChatRunBlock key={run.id} run={run} />
        ))}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}

function RenderEmpty() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <ConversationEmptyState
        icon={
          <div className="mb-2 flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
            <IconSparkles className="size-6 text-primary" />
          </div>
        }
        title="Start a conversation"
        description="Ask anything about your project, reference files with @, and let the agent help you create."
      />
    </div>
  )
}
