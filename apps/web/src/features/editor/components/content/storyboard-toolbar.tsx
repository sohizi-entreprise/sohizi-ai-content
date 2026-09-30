import { Globe, Paperclip, Play } from "lucide-react"

type StoryboardToolbarProps = {
  hasShots: boolean
  onViewSequence: () => void
  onOpenWorld: () => void
  onAttachContext: () => void
}

export function StoryboardToolbar({
  hasShots,
  onViewSequence,
  onOpenWorld,
  onAttachContext,
}: StoryboardToolbarProps) {
  return (
    <div className="storyboard-toolbar">
      <div className="storyboard-toolbar-pill">
        <button
          type="button"
          className="storyboard-toolbar-play"
          onClick={onViewSequence}
          disabled={!hasShots}
          title={hasShots ? "View sequence" : "Add a shot to view the sequence"}
          aria-label="View sequence"
        >
          <Play className="size-4 fill-current" />
        </button>
        <button
          type="button"
          className="storyboard-toolbar-action"
          onClick={onViewSequence}
          disabled={!hasShots}
        >
          View Sequence
        </button>
        <span className="storyboard-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="storyboard-toolbar-action"
          onClick={onOpenWorld}
        >
          <Globe className="size-3.5" />
          World
        </button>
        <span className="storyboard-toolbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="storyboard-toolbar-action"
          onClick={onAttachContext}
        >
          <Paperclip className="size-3.5" />
          Attach Context
        </button>
      </div>
    </div>
  )
}
