import { useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { IconSparkles, IconLoader2 } from '@tabler/icons-react'
import { StoreConversation, useChatStore } from '../store/chat-store'
import { listAgentRunsInfiniteQueryOptions } from '../query-mutation'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useShallow } from 'zustand/shallow'
import { useAutoScroll } from '@/hooks/use-auto-scroll'
import { ChatRunBlock } from './chat-run-block'

export function ChatMessages({ projectId }: { projectId: string; className?: string }) {
  const conversation = useChatStore(useShallow((state) => state.activeConversation))
  // useEffect(() => {
  //   if (pendingMessage && scrollRef.current) {
  //     requestAnimationFrame(() => {
  //       if (scrollRef.current) {
  //         scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  //       }
  //     })
  //   }
  // }, [pendingMessage])


  if (!conversation) {
    return <RenderEmpty />
  }

  return <RenderAgentRuns conversation={conversation} projectId={projectId} />
}


function RenderAgentRuns(props: {conversation: StoreConversation; projectId: string}){
  const {conversation, projectId} = props
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const prevScrollHeightRef = useRef<number>(0)
  
  const isStreaming = conversation.isStreaming ?? false
  const isNew = conversation.isNew ?? true

  useAutoScroll({
    scrollRef,
    contentRef,
    isStreaming,
    scrollOnMount: true,
  })

  const {
    data: runs = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(listAgentRunsInfiniteQueryOptions(projectId, conversation.id, isNew))

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || prevScrollHeightRef.current === 0) return

    const diff = el.scrollHeight - prevScrollHeightRef.current
    if (diff > 0) {
      el.scrollTop += diff
    }
    prevScrollHeightRef.current = 0
  }, [runs])

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
      { root: viewport, rootMargin: '100px 0px 0px 0px', threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleFetchOlder])

  


  if (isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <span className="text-sm text-muted-foreground">Loading messages...</span>
      </div>
    )
  }

  if(runs.length === 0){
    return <RenderEmpty />
  }

  return (
    <div className='flex-1 overflow-y-auto w-full' ref={scrollRef}>
      <div className="p-4 space-y-4" ref={contentRef}>
        <div ref={sentinelRef} className="h-1" />
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {runs.map((run) => (
          <ChatRunBlock key={run.id} run={run} />
        ))}
      </div>
    </div>
  )
}

function RenderEmpty(){
  return (
    <div className='flex-1 flex items-center justify-center'>
      <div className="text-center text-muted-foreground">
        <IconSparkles className="size-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Start a conversation</p>
        <p className="text-xs mt-1">Ask me anything about your content</p>
      </div>
    </div>
  )
}
