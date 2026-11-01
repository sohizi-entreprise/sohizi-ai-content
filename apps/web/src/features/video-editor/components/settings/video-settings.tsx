import type { ReactNode } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { useVideoEditorStore } from "../../store/editor-store"
import { FadeDurationFields } from "./setting-row"
import { SliderWithValue } from "./slider-with-value"
import type {
  ClipAnimationIn,
  ClipAnimationOut,
  ObjectFitMode,
  VideoClip,
} from "../../store/types"

interface VideoSettingsProps {
  clip: VideoClip
}

const FIT_MODES: Array<{ id: ObjectFitMode; label: string }> = [
  { id: "contain", label: "Contain (Fit)" },
  { id: "cover", label: "Cover (Fill)" },
]

const ANIMATIONS_IN: Array<{ id: ClipAnimationIn; label: string }> = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade in" },
  { id: "slide-up", label: "Slide up" },
  { id: "scale-up", label: "Scale up" },
]

const ANIMATIONS_OUT: Array<{ id: ClipAnimationOut; label: string }> = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade out" },
  { id: "slide-down", label: "Slide down" },
  { id: "scale-down", label: "Scale down" },
]

export function VideoSettings({ clip }: VideoSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const dimensions =
    clip.width && clip.height ? `${clip.width} × ${clip.height}` : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/25 p-2">
        <video
          src={clip.url}
          muted
          playsInline
          preload="metadata"
          className="size-12 shrink-0 rounded-lg bg-muted object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {clip.fileName}
          </p>
          {dimensions ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{dimensions}</p>
          ) : null}
        </div>
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
        <SectionLabel>Appearance</SectionLabel>
        <SliderField label="Fit">
          <Select
            value={clip.fit ?? "contain"}
            onValueChange={(v) =>
              updateClip(clip.id, { fit: v as ObjectFitMode })
            }
          >
            <SelectTrigger size="sm" className="h-9 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIT_MODES.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SliderField>
        <SliderField label="Opacity">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.opacity * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { opacity: v / 100 })}
          />
        </SliderField>
        <SliderField label="Blur">
          <SliderWithValue
            min={0}
            max={20}
            step={0.5}
            value={Number((clip.blur ?? 0).toFixed(1))}
            suffix="px"
            onChange={(v) => updateClip(clip.id, { blur: v })}
          />
        </SliderField>
        <SliderField label="Brightness">
          <SliderWithValue
            min={0}
            max={200}
            value={Math.round(clip.brightness ?? 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { brightness: v })}
          />
        </SliderField>
        <SliderField label="Round">
          <SliderWithValue
            min={0}
            max={200}
            value={clip.borderRadius}
            suffix="px"
            onChange={(v) => updateClip(clip.id, { borderRadius: v })}
          />
        </SliderField>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Transitions & Motion</SectionLabel>
        <FadeDurationFields
          clipId={clip.id}
          startFrame={clip.startFrame}
          endFrame={clip.endFrame}
          fadeInFrames={clip.fadeInFrames}
          fadeOutFrames={clip.fadeOutFrames}
        />
        <div className="grid grid-cols-2 gap-2">
          <SliderField label="Enter">
            <Select
              value={clip.animationIn ?? "none"}
              onValueChange={(v) =>
                updateClip(clip.id, { animationIn: v as ClipAnimationIn })
              }
            >
              <SelectTrigger size="sm" className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANIMATIONS_IN.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SliderField>
          <SliderField label="Exit">
            <Select
              value={clip.animationOut ?? "none"}
              onValueChange={(v) =>
                updateClip(clip.id, { animationOut: v as ClipAnimationOut })
              }
            >
              <SelectTrigger size="sm" className="h-9 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANIMATIONS_OUT.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SliderField>
        </div>
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
