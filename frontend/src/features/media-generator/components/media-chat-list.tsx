import { useCallback, useEffect, useRef } from 'react'
import { IconLoader2 } from '@tabler/icons-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import MediaChatCard from './media-chat-card'
import { listAssetsRequestsQueryOptions } from '../query-mutations'


type MediaChatListProps = {
  projectId: string
  className?: string
}

export function MediaChatList({ projectId, className }: MediaChatListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data: assetsRequests = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(listAssetsRequestsQueryOptions(projectId))

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
      <div className='flex-1 flex items-center justify-center'>
        ...loading
      </div>
    )
  }

  if (assetsRequests.length === 0) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        No assets requests found
      </div>
    )
  }

  return (
    <Conversation className={className}>
      <ConversationContent className="space-y-8 p-4">
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {assetsRequests.map((run) => (
          <MediaChatCard key={run.id} run={run} />
        ))}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
