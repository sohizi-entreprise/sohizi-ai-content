import { IconCheck, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

type DiffActionsProps = {
  onAccept: () => void
  onReject: () => void
  size?: 'sm' | 'md'
  className?: string
}

export function DiffActions({ 
  onAccept, 
  onReject, 
  size = 'sm',
  className 
}: DiffActionsProps) {
  const iconSize = size === 'sm' ? 'size-3' : 'size-4'
  const buttonSize = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={onAccept}
        className={cn(
          'flex items-center gap-1 rounded transition-colors',
          'bg-green-500/20 text-green-400 hover:bg-green-500/30',
          buttonSize
        )}
      >
        <IconCheck className={iconSize} />
        <span>Accept</span>
      </button>
      <button
        onClick={onReject}
        className={cn(
          'flex items-center gap-1 rounded transition-colors',
          'bg-red-500/20 text-red-400 hover:bg-red-500/30',
          buttonSize
        )}
      >
        <IconX className={iconSize} />
        <span>Reject</span>
      </button>
    </div>
  )
}

/**
 * Inline diff actions that appear next to highlighted text
 */
export function InlineDiffActions({
  onAccept,
  onReject,
  position,
}: {
  onAccept: () => void
  onReject: () => void
  position: { x: number; y: number }
}) {
  return (
    <div
      className="fixed z-50 flex items-center gap-1 bg-popover border border-white/10 rounded-lg shadow-xl p-1"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        onClick={onAccept}
        className="p-1 rounded hover:bg-green-500/20 text-green-400 transition-colors"
        title="Accept change"
      >
        <IconCheck className="size-4" />
      </button>
      <button
        onClick={onReject}
        className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
        title="Reject change"
      >
        <IconX className="size-4" />
      </button>
    </div>
  )
}
