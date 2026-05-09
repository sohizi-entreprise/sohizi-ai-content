import { useEffect, useRef, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { getAudioPeaks } from '../waveform'
import type { AudioClip } from '../../store/types'
import { cn } from '@/lib/utils'

interface AudioBlockProps {
  clip: AudioClip
  selected: boolean
}

export function AudioBlock({ clip, selected }: AudioBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [peaks, setPeaks] = useState<Float32Array | null>(null)

  useEffect(() => {
    let cancelled = false
    getAudioPeaks(clip.id, clip.url)
      .then((p) => {
        if (!cancelled) setPeaks(p)
      })
      .catch(() => {
        if (!cancelled) setPeaks(null)
      })
    return () => {
      cancelled = true
    }
  }, [clip.id, clip.url])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = parent.getBoundingClientRect()
      const w = Math.max(1, Math.floor(rect.width))
      const h = Math.max(1, Math.floor(rect.height))
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      if (!peaks || peaks.length === 0) return
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      const mid = h / 2
      for (let i = 0; i < w; i += 1) {
        const idx = Math.floor((i / w) * peaks.length)
        const p = peaks[idx] ?? 0
        const barH = Math.max(1, p * (h * 0.9))
        ctx.fillRect(i, mid - barH / 2, 1, barH)
      }
    }

    draw()

    const ro = new ResizeObserver(draw)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [peaks])

  return (
    <div
      className={cn(
        'flex h-full w-full items-stretch overflow-hidden rounded-md border',
        selected ? 'border-white ring-2 ring-white' : 'border-amber-600/70',
      )}
      style={{
        background: selected
          ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
          : 'linear-gradient(180deg, #d97706 0%, #b45309 100%)',
      }}
      title={clip.fileName}
    >
      <div className="flex h-full items-center gap-1 pl-2 pr-1 text-[11px] text-amber-50">
        <Volume2 className="size-3 shrink-0" />
        <span className="max-w-[90px] truncate">{clip.fileName}</span>
      </div>
      <div className="relative h-full flex-1">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </div>
  )
}
