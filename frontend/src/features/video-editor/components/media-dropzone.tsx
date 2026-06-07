import { useCallback, useMemo, useRef, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { useVideoEditorStore } from '../store/editor-store'
import { uploadMediaAsset } from '../requests'
import { secondsToFrames } from '../utils/time'
import {
  probeImageDimensions,
  probeMediaDuration,
} from '../utils/media-probe'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMutation } from '@tanstack/react-query'
import { generateCaptionMutationOptions } from '../query-mutations'
import { toast } from 'sonner'

interface MediaDropzoneProps {
  projectId: string
  className?: string
}

export function MediaDropzone({ projectId, className }: MediaDropzoneProps) {
  const [uploading, setUploading] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const fps = useVideoEditorStore((s) => s.fps)
  const tracks = useVideoEditorStore((s) => s.tracks)
  const selection = useVideoEditorStore((s) => s.selection)
  const addVideoClip = useVideoEditorStore((s) => s.addVideoClip)
  const addAudioClip = useVideoEditorStore((s) => s.addAudioClip)
  const addTextClip = useVideoEditorStore((s) => s.addTextClip)
  const addImageClip = useVideoEditorStore((s) => s.addImageClip)
  const rootFolderId = useFileTreeStore((s) => s.rootFolderId)

  const { mutate: generateCaption, isPending: isGeneratingCaption } = useMutation(generateCaptionMutationOptions(projectId))

  const selectedClip = useMemo(() => {
    if (selection.clipIds.length !== 1) return null
    const id = selection.clipIds[0]
    for (const track of tracks) {
      for (const clip of track.clips) {
        if (clip.id === id) return clip
      }
    }
    return null
  }, [tracks, selection])

  const showAddCaption =
    selectedClip?.type === 'video' || selectedClip?.type === 'audio'

  const ingestFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      const folderId = rootFolderId
      if (!folderId) return

      for (const file of Array.from(files)) {
        try {
          setUploading((c) => c + 1)

          const localUrl = URL.createObjectURL(file)

          if (file.type.startsWith('video/')) {
            const seconds = await probeMediaDuration(localUrl, 'video')
            const asset = await uploadMediaAsset(projectId, folderId, file)
            URL.revokeObjectURL(localUrl)
            addVideoClip({
              url: asset.url,
              fileName: asset.name,
              durationInFrames: secondsToFrames(seconds, fps),
            })
          } else if (file.type.startsWith('audio/')) {
            const seconds = await probeMediaDuration(localUrl, 'audio')
            const asset = await uploadMediaAsset(projectId, folderId, file)
            URL.revokeObjectURL(localUrl)
            addAudioClip({
              url: asset.url,
              fileName: asset.name,
              durationInFrames: secondsToFrames(seconds, fps),
            })
          } else if (file.type.startsWith('image/')) {
            const dims = await probeImageDimensions(localUrl)
            const asset = await uploadMediaAsset(projectId, folderId, file)
            URL.revokeObjectURL(localUrl)
            addImageClip({
              url: asset.url,
              fileName: asset.name,
              width: dims.width,
              height: dims.height,
              durationInFrames: fps * 5,
            })
          } else {
            URL.revokeObjectURL(localUrl)
          }
        } catch {
          // skip on failure
        } finally {
          setUploading((c) => c - 1)
        }
      }
    },
    [fps, projectId, rootFolderId, addVideoClip, addAudioClip, addImageClip],
  )

  const handleAddText = () => {
    addTextClip({
      text: 'New text',
      durationInFrames: fps * 3,
    })
  }

  const handleAddCaption = () => {
    if (!selectedClip) return
    const trackId = selectedClip.trackId
    
    generateCaption(trackId, {
      onError: (error) => {
        toast.error(error.message)
      }
    })
  }

  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-3',
        className,
      )}
    >
      {uploading > 0 ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs text-primary"
        onClick={() => inputRef.current?.click()}
        disabled={uploading > 0}
      >
        <Plus className="size-3" />
        Add media
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={handleAddText}
      >
        <Plus className="size-3" />
        Add text
      </Button>
      {showAddCaption ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleAddCaption}
          disabled={isGeneratingCaption}
        >
          {isGeneratingCaption ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : (
            <Plus className="size-3" />
          )}
          Add caption
        </Button>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void ingestFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
