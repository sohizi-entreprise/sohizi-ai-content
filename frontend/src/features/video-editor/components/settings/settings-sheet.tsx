import { useMemo } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { XIcon } from 'lucide-react'
import { useVideoEditorStore } from '../../store/editor-store'
import { TextSettings } from './text-settings'
import { VideoSettings } from './video-settings'
import { ImageSettings } from './image-settings'
import { AudioSettings } from './audio-settings'
import type { Clip } from '../../store/types'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<Clip['type'], string> = {
  text: 'Text',
  video: 'Video',
  image: 'Image',
  audio: 'Audio',
}

export function SettingsSheet() {
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

  const open = selectedClip !== null

  return (
    <DialogPrimitive.Root
      open={open}
      modal={false}
      onOpenChange={(next) => {
        if (!next) clearSelection()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          // Keep the canvas/timeline interactive while the sheet is open:
          // suppress Radix's auto-close behaviors that fire on outside
          // pointerdown / focus shifts.
          onInteractOutside={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'bg-background fixed inset-y-0 right-0 z-40 flex h-full w-[360px] flex-col overflow-hidden border-l shadow-lg sm:max-w-[360px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'data-[state=closed]:duration-200 data-[state=open]:duration-300',
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-sm font-semibold text-foreground">
              {selectedClip ? TYPE_LABEL[selectedClip.type] : 'Settings'}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Edit settings for the selected clip
            </DialogPrimitive.Description>
            <DialogPrimitive.Close
              className="rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto">
            {selectedClip ? <SettingsBody clip={selectedClip} /> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
    default:
      return null
  }
}
