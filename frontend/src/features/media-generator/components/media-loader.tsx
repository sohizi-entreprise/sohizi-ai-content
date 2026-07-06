import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export default function MediaLoader({className}: {className?: string}) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 bg-background rounded-md p-2', className)}>
        <Skeleton className='size-full'/>
        <Skeleton className='size-full'/>
        <Skeleton className='size-full'/>
        <Skeleton className='size-full'/>
    </div>
  )
}

