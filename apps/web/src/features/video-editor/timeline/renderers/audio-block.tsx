import { useEffect, useRef } from "react"
import WaveSurfer from "wavesurfer.js"
import { AudioLines } from "lucide-react"
import { useVideoEditorStore } from "../../store/editor-store"
import { framesToSeconds } from "../../utils/time"
import { getAudioPeaks, sliceAudioPeaks } from "../waveform"
import { CLIP_ACCENT, ClipShell } from "./clip-shell"
import type { AudioClip } from "../../store/types"

interface AudioBlockProps {
  clip: AudioClip
  selected: boolean
}

export function AudioBlock({ clip, selected }: AudioBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const fps = useVideoEditorStore((s) => s.fps)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let cancelled = false
    let wavesurfer: WaveSurfer | null = null
    let ro: ResizeObserver | null = null
    let peakChannel: Array<number> | null = null
    let duration = 1

    const teardown = () => {
      ro?.disconnect()
      ro = null
      wavesurfer?.destroy()
      wavesurfer = null
      el.replaceChildren()
    }

    const createWave = () => {
      if (cancelled || !el.isConnected || !peakChannel) return
      const width = Math.floor(el.clientWidth)
      const height = Math.floor(el.clientHeight)
      if (width < 2 || height < 2) return

      wavesurfer?.destroy()
      el.replaceChildren()

      // Canvas fillStyle cannot parse color-mix(); keep a solid accent.
      const waveColor = CLIP_ACCENT.audio
      wavesurfer = WaveSurfer.create({
        container: el,
        width,
        height: Math.max(height - 2, 14),
        interact: false,
        dragToSeek: false,
        cursorWidth: 0,
        hideScrollbar: true,
        normalize: true,
        fillParent: true,
        waveColor,
        progressColor: waveColor,
        barWidth: 1,
        barGap: 0.5,
        barRadius: 1,
        barHeight: 0.9,
      })

      void wavesurfer
        .load("", [peakChannel], duration)
        .catch((err: unknown) => {
          console.warn("[audio-block] wavesurfer load failed", err)
        })
    }

    const mount = async () => {
      try {
        const { peaks, durationSec } = await getAudioPeaks(clip.id, clip.url)
        if (cancelled || !el.isConnected) return
        if (!peaks.length || durationSec <= 0) return

        const clipDurationSec = framesToSeconds(
          clip.sourceDurationInFrames || clip.endFrame - clip.startFrame,
          fps,
        )
        const clipStartSec = framesToSeconds(clip.sourceStartFrame, fps)
        const windowPeaks = sliceAudioPeaks(
          peaks,
          durationSec,
          clipStartSec,
          clipDurationSec || durationSec,
        )
        peakChannel = Array.from(windowPeaks)
        if (peakChannel.every((v) => v === 0)) return
        duration = Math.max(0.01, clipDurationSec || durationSec)

        createWave()

        let lastW = el.clientWidth
        let lastH = el.clientHeight
        ro = new ResizeObserver(() => {
          if (cancelled || !peakChannel) return
          const w = el.clientWidth
          const h = el.clientHeight
          if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return
          lastW = w
          lastH = h
          createWave()
        })
        ro.observe(el)
      } catch (err) {
        console.warn("[audio-block] failed to render waveform", err)
      }
    }

    void mount()

    return () => {
      cancelled = true
      teardown()
    }
  }, [
    clip.id,
    clip.url,
    clip.sourceStartFrame,
    clip.sourceDurationInFrames,
    clip.startFrame,
    clip.endFrame,
    fps,
  ])

  return (
    <ClipShell
      type="audio"
      selected={selected}
      label={clip.fileName}
      icon={AudioLines}
      labelOverlay
    >
      <div
        ref={containerRef}
        className="pointer-events-none h-full w-full min-h-0 min-w-0"
      />
    </ClipShell>
  )
}
