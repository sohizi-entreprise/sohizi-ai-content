import { useCallback, useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { useVideoEditorStore } from '../store/editor-store'
import { secondsToFrames } from '../utils/time'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MediaDropzoneProps {
  className?: string
}

export function MediaDropzone({ className }: MediaDropzoneProps) {
  const [active, setActive] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const fps = useVideoEditorStore((s) => s.fps)
  const addVideoClip = useVideoEditorStore((s) => s.addVideoClip)
  const addAudioClip = useVideoEditorStore((s) => s.addAudioClip)
  const addTextClip = useVideoEditorStore((s) => s.addTextClip)
  const addImageClip = useVideoEditorStore((s) => s.addImageClip)

  const ingestFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      for (const file of Array.from(files)) {
        try {
          if (file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file)
            const seconds = await probeMediaDuration(url, 'video')
            addVideoClip({
              url,
              fileName: file.name,
              durationInFrames: secondsToFrames(seconds, fps),
            })
          } else if (file.type.startsWith('audio/')) {
            const url = URL.createObjectURL(file)
            const seconds = await probeMediaDuration(url, 'audio')
            addAudioClip({
              url,
              fileName: file.name,
              durationInFrames: secondsToFrames(seconds, fps),
            })
          } else if (file.type.startsWith('image/')) {
            const url = URL.createObjectURL(file)
            const dims = await probeImageDimensions(url)
            addImageClip({
              url,
              fileName: file.name,
              width: dims.width,
              height: dims.height,
              durationInFrames: fps * 5,
            })
          } else {
            // ignore unsupported
          }
        } catch {
          // skip on failure
        }
      }
    },
    [fps, addVideoClip, addAudioClip, addImageClip],
  )

  const handleAddText = () => {
    addTextClip({
      text: 'New text',
      durationInFrames: fps * 3,
    })
  }

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault()
        setActive(true)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setActive(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setActive(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setActive(false)
        void ingestFiles(e.dataTransfer.files)
      }}
      className={cn(
        'flex h-9 shrink-0 items-center gap-2 border-b border-border px-3 transition-colors',
        active ? 'bg-accent/40' : 'bg-card',
        className,
      )}
    >
      <Upload className="size-3.5 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground">
        Drop video, image, or audio files here, or
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs text-primary"
        onClick={() => inputRef.current?.click()}
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

function probeImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const cleanup = () => {
      img.onload = null
      img.onerror = null
    }
    img.onload = () => {
      cleanup()
      const w = img.naturalWidth || img.width || 1
      const h = img.naturalHeight || img.height || 1
      resolve({ width: w, height: h })
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('Failed to read image dimensions'))
    }
    img.src = url
  })
}

function probeMediaDuration(
  url: string,
  kind: 'video' | 'audio',
): Promise<number> {
  return new Promise((resolve, reject) => {
    const el =
      kind === 'video'
        ? document.createElement('video')
        : document.createElement('audio')
    el.preload = 'metadata'
    el.muted = true
    if ('playsInline' in el) {
      ;(el as HTMLVideoElement).playsInline = true
    }

    const onLoaded = () => {
      cleanup()
      const dur =
        Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 5
      resolve(dur)
    }
    const onError = () => {
      cleanup()
      reject(new Error('Failed to read media metadata'))
    }
    const cleanup = () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('error', onError)
    }
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('error', onError)
    el.src = url
  })
}
