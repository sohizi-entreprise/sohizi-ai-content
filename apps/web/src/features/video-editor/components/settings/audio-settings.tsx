import { AudioLines } from "lucide-react"
import { useVideoEditorStore } from "../../store/editor-store"
import { FadeDurationFields } from "./setting-row"
import { SliderWithValue } from "./slider-with-value"
import type { ReactNode } from "react"
import type { AudioClip } from "../../store/types"

interface AudioSettingsProps {
  clip: AudioClip
}

export function AudioSettings({ clip }: AudioSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/25 p-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-foreground">
          <AudioLines className="size-4" />
        </span>
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {clip.fileName}
        </p>
      </div>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Playback</SectionLabel>
        <SliderField label="Speed">
          <SliderWithValue
            min={0.25}
            max={4}
            step={0.05}
            value={Number(clip.speed.toFixed(2))}
            suffix="×"
            onChange={(v) => updateClip(clip.id, { speed: v })}
          />
        </SliderField>
        <SliderField label="Volume">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.volume * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { volume: v / 100 })}
          />
        </SliderField>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Audio Fades</SectionLabel>
        <FadeDurationFields
          clipId={clip.id}
          startFrame={clip.startFrame}
          endFrame={clip.endFrame}
          fadeInFrames={clip.fadeInFrames}
          fadeOutFrames={clip.fadeOutFrames}
        />
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">
      {children}
    </span>
  )
}

function SliderField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
