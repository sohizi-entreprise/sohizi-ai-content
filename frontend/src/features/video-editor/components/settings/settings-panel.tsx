import { useMemo } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useVideoEditorStore } from '../../store/editor-store'
import { TextSettings } from './text-settings'
import { VideoSettings } from './video-settings'
import { ImageSettings } from './image-settings'
import { AudioSettings } from './audio-settings'
import { HtmlSettings } from './html-settings'
import { CaptionSettings } from './caption-settings'
import { AddMediaPanel } from './add/add-media-panel'
import type { Clip } from '../../store/types'
import { Button } from '@/components/ui/button'

const TYPE_LABEL: Record<Clip['type'], string> = {
  text: 'Text',
  video: 'Video',
  image: 'Image',
  audio: 'Audio',
  html: 'HTML',
  caption: 'Caption',
}

export function SettingsPanel() {
  const tracks = useVideoEditorStore((s) => s.tracks)
  const selection = useVideoEditorStore((s) => s.selection)
  const clearSelection = useVideoEditorStore((s) => s.clearSelection)

  const selectedClip = useMemo<Clip | null>(() => {
    if (selection.clipIds.length !== 1) return null
    const id = selection.clipIds[0]
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === id) return clip
      }
    }
    return null
  }, [tracks, selection])

  if (!selectedClip) {
    return (
      <div className="h-full min-h-0 p-3">
        <AddMediaPanel />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col pb-1">
      <div className="flex shrink-0 items-center gap-1 px-2 py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 text-foreground"
          onClick={clearSelection}
          aria-label="Back to settings"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <h2 className="text-base font-semibold text-foreground">
          Adjust {TYPE_LABEL[selectedClip.type]}
        </h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <SettingsBody clip={selectedClip} />
      </div>
    </div>
  )
}

function SettingsBody({ clip }: { clip: Clip }) {
  switch (clip.type) {
    case 'text':
      return <TextSettings clip={clip} />
    case 'video':
      return <VideoSettings clip={clip} />
    case 'image':
      return <ImageSettings clip={clip} />
    case 'audio':
      return <AudioSettings clip={clip} />
    case 'html':
      return <HtmlSettings clip={clip} />
    case 'caption':
      return <CaptionSettings clip={clip} />
    default:
      return null
  }
}
