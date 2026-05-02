import { useOldEditorStore } from '../../store/editor-store'
import { DiffActions } from './diff-actions'
import { cn } from '@/lib/utils'

type DiffOverlayProps = {
  className?: string
  onAccept?: (id: string) => void
  onReject?: (id: string) => void
}

export function DiffOverlay({ className, onAccept, onReject }: DiffOverlayProps) {
  const { 
    pendingSuggestions, 
    showDiffs,
    acceptSuggestion,
    rejectSuggestion,
  } = useOldEditorStore()

  const pendingCount = pendingSuggestions.filter(s => s.status === 'pending').length

  if (!showDiffs || pendingCount === 0) {
    return null
  }

  const handleAccept = (id: string) => {
    if (onAccept) {
      onAccept(id)
    } else {
      acceptSuggestion(id)
    }
  }

  const handleReject = (id: string) => {
    if (onReject) {
      onReject(id)
    } else {
      rejectSuggestion(id)
    }
  }

  const handleAcceptAll = () => {
    pendingSuggestions
      .filter(s => s.status === 'pending')
      .forEach(s => handleAccept(s.id))
  }

  const handleRejectAll = () => {
    pendingSuggestions
      .filter(s => s.status === 'pending')
      .forEach(s => handleReject(s.id))
  }

  return (
    <div className={cn(
      'fixed bottom-4 right-4 z-50',
      'bg-popover border border-white/10 rounded-lg shadow-xl',
      'p-4 max-w-sm',
      className
    )}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">
          AI Suggestions ({pendingCount})
        </h3>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto">
        {pendingSuggestions
          .filter(s => s.status === 'pending')
          .map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-3 bg-white/5 rounded-lg border border-white/10"
            >
              <div className="flex items-start gap-2 mb-2">
                <SuggestionTypeBadge type={suggestion.type} />
                {suggestion.reason && (
                  <p className="text-xs text-muted-foreground flex-1">
                    {suggestion.reason}
                  </p>
                )}
              </div>

              {suggestion.type !== 'comment' && (
                <div className="text-sm mb-3">
                  {suggestion.originalContent && (
                    <div className="mb-1">
                      <span className="text-xs text-muted-foreground">Original:</span>
                      <p className="line-through text-red-400/70 text-xs">
                        {truncate(suggestion.originalContent, 100)}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground">Suggested:</span>
                    <p className="text-green-400/70 text-xs">
                      {truncate(suggestion.content, 100)}
                    </p>
                  </div>
                </div>
              )}

              <DiffActions
                onAccept={() => handleAccept(suggestion.id)}
                onReject={() => handleReject(suggestion.id)}
              />
            </div>
          ))}
      </div>

      {pendingCount > 1 && (
        <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
          <button
            onClick={handleAcceptAll}
            className="flex-1 px-3 py-1.5 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
          >
            Accept All
          </button>
          <button
            onClick={handleRejectAll}
            className="flex-1 px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
          >
            Reject All
          </button>
        </div>
      )}
    </div>
  )
}

function SuggestionTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    replacement: 'bg-blue-500/20 text-blue-400',
    insertion: 'bg-green-500/20 text-green-400',
    deletion: 'bg-red-500/20 text-red-400',
    comment: 'bg-yellow-500/20 text-yellow-400',
  }

  return (
    <span className={cn(
      'px-2 py-0.5 text-xs rounded-full capitalize',
      colors[type] || 'bg-white/10 text-white'
    )}>
      {type}
    </span>
  )
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}
