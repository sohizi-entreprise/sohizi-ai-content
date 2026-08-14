import { ResizableHandle } from '@/components/ui/resizable'
import { cn } from '@/lib/utils'

interface PanelHandleProps {
  className?: string
}

export function PanelHandle({ className }: PanelHandleProps) {
  return (
    <ResizableHandle
      className={cn(
        'group relative w-2 shrink-0 bg-transparent transition-colors',
        'data-[panel-group-direction=vertical]:h-2 data-[panel-group-direction=vertical]:w-full',
        'after:absolute after:rounded-full after:bg-transparent after:transition-colors',
        'after:inset-y-2 after:left-1/2 after:w-[3px] after:-translate-x-1/2',
        'data-[panel-group-direction=vertical]:after:inset-x-3 data-[panel-group-direction=vertical]:after:top-1/2 data-[panel-group-direction=vertical]:after:h-[3px] data-[panel-group-direction=vertical]:after:w-auto data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2',
        className,
      )}
    />
  )
}
