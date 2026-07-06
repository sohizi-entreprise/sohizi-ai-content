import { cn } from '@/lib/utils'
import MediaChatCard from './media-chat-card'
import { listAssetsRequestsQueryOptions } from '../query-mutations'
import { useInfiniteQuery } from '@tanstack/react-query'


type MediaChatListProps = {
  projectId: string
  className?: string
}

export function MediaChatList({ projectId, className }: MediaChatListProps) {
  const { data: assetsRequests, isLoading } = useInfiniteQuery(listAssetsRequestsQueryOptions(projectId))

  if(isLoading){
    return (
      <div className='flex-1 flex items-center justify-center'>
        ...loading
      </div>
    )
  }

  if(!assetsRequests || assetsRequests?.length === 0){
    return (
      <div className='flex-1 flex items-center justify-center'>
        No assets requests found
      </div>
    )
  }


  return (
    <div
      className={cn(
        'relative flex-1 overflow-y-auto space-y-14 p-4',
        className,
      )}
    >
      {
        assetsRequests.map((run) => (
          <MediaChatCard key={run.id} run={run}/>
        ))
      }
    </div>
  )
}

