import { IconX, IconUser, IconMapPin, IconTextCaption, IconMovie } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import type { ContextItem, ContextType } from '../types'

type ContextChipProps = {
  context: ContextItem
  onRemove?: (id: string) => void
  className?: string
  readonly?: boolean
}

const contextIcons: Record<ContextType, React.ReactNode> = {
  selection: <IconTextCaption className="size-3" />,
  character: <IconUser className="size-3" />,
  location: <IconMapPin className="size-3" />,
  scene: <IconMovie className="size-3" />,
}

const contextColors: Record<ContextType, string> = {
  selection: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  character: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  location: 'bg-green-500/20 text-green-400 border-green-500/30',
  scene: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

export function ContextChip({ context, onRemove, className, readonly = false }: ContextChipProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border',
        'max-w-[200px] group',
        contextColors[context.type],
        className
      )}
    >
      {contextIcons[context.type]}
      <span className="truncate">{context.label}</span>
      {!readonly && onRemove && (
        <button
          onClick={() => onRemove(context.id)}
          className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
          aria-label={`Remove ${context.label}`}
        >
          <IconX className="size-3" />
        </button>
      )}
    </div>
  )
}

type ContextChipListProps = {
  contexts: ContextItem[]
  onRemove?: (id: string) => void
  className?: string
  readonly?: boolean
}

export function ContextChipList({ contexts, onRemove, className, readonly = false }: ContextChipListProps) {
  if (contexts.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {contexts.map((context) => (
        <ContextChip
          key={context.id}
          context={context}
          onRemove={onRemove}
          readonly={readonly}
        />
      ))}
    </div>
  )
}
