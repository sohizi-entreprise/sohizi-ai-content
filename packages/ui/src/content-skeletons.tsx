import { cn } from './lib/utils'

export function TextSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="h-2 w-1/3 rounded-full bg-slate-400/10" />
      <div className="h-2 w-full rounded-full bg-slate-400/10" />
      <div className="h-2 w-[90%] rounded-full bg-slate-400/8" />
      <div className="mx-auto h-2 w-[90%] rounded-full bg-slate-400/6" />
      <div className="h-2 w-full rounded-full bg-slate-400/4" />
      <div className="h-2 w-[85%] rounded-full bg-slate-400/3" />
      <div className="h-2 w-[92%] rounded-full bg-slate-400/2" />
    </div>
  )
}

export function AssetSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center',
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="size-20 animate-asset-skeleton-pulse rounded-2xl bg-slate-400/10" />
        <div className="size-20 animate-asset-skeleton-pulse rounded-2xl bg-slate-400/10 [animation-delay:120ms]" />
        <div className="size-20 animate-asset-skeleton-pulse rounded-2xl bg-slate-400/10 [animation-delay:240ms]" />
        <div className="size-20 animate-asset-skeleton-pulse rounded-2xl bg-slate-400/10 [animation-delay:360ms]" />
      </div>
    </div>
  )
}
