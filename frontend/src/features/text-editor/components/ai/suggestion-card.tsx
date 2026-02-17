import { IconSparkles, IconMessage } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import type { AISuggestion } from '../../store/types'
import { DiffActions } from './diff-actions'

type SuggestionCardProps = {
  suggestion: AISuggestion
  onAccept: () => void
  onReject: () => void
  className?: string
}

export function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  className,
}: SuggestionCardProps) {
  const isComment = suggestion.type === 'comment'

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-all',
        suggestion.status === 'pending'
          ? 'bg-white/5 border-white/10'
          : suggestion.status === 'accepted'
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-red-500/10 border-red-500/30 opacity-50',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={cn(
            'p-2 rounded-lg',
            isComment ? 'bg-yellow-500/20' : 'bg-primary/20'
          )}
        >
          {isComment ? (
            <IconMessage className="size-4 text-yellow-400" />
          ) : (
            <IconSparkles className="size-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">
              {suggestion.type}
            </span>
            <StatusBadge status={suggestion.status} />
          </div>
          {suggestion.reason && (
            <p className="text-xs text-muted-foreground mt-1">
              {suggestion.reason}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      {!isComment && (
        <div className="space-y-2 mb-4">
          {suggestion.originalContent && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/20">
              <span className="text-xs text-red-400 block mb-1">Remove:</span>
              <p className="text-sm line-through text-red-400/70">
                {suggestion.originalContent}
              </p>
            </div>
          )}
          <div className="p-2 rounded bg-green-500/10 border border-green-500/20">
            <span className="text-xs text-green-400 block mb-1">
              {suggestion.type === 'insertion' ? 'Insert:' : 'Replace with:'}
            </span>
            <p className="text-sm text-green-400/70">{suggestion.content}</p>
          </div>
        </div>
      )}

      {isComment && (
        <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20 mb-4">
          <p className="text-sm text-yellow-400/90">{suggestion.content}</p>
        </div>
      )}

      {/* Actions */}
      {suggestion.status === 'pending' && (
        <DiffActions onAccept={onAccept} onReject={onReject} size="md" />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: AISuggestion['status'] }) {
  if (status === 'pending') return null

  const colors = {
    accepted: 'bg-green-500/20 text-green-400',
    rejected: 'bg-red-500/20 text-red-400',
  }

  return (
    <span className={cn('px-2 py-0.5 text-xs rounded-full', colors[status])}>
      {status}
    </span>
  )
}
