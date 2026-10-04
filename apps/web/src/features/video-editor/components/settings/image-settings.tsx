import type { ReactNode } from "react"
import { useVideoEditorStore } from "../../store/editor-store"
import { SliderWithValue } from "./slider-with-value"
import type { ImageClip } from "../../store/types"

interface ImageSettingsProps {
  clip: ImageClip
}

export function ImageSettings({ clip }: ImageSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const dimensions =
    clip.width && clip.height ? `${clip.width} × ${clip.height}` : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/25 p-2">
        <img
          src={clip.url}
          alt=""
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
        <SectionLabel>Position</SectionLabel>
        <SliderField label="Horizontal">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.xRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { xRatio: v / 100 })}
          />
        </SliderField>
        <SliderField label="Vertical">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.yRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { yRatio: v / 100 })}
          />
        </SliderField>
        <SliderField label="Width">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(clip.widthRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { widthRatio: v / 100 })}
          />
        </SliderField>
        <SliderField label="Height">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(clip.heightRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { heightRatio: v / 100 })}
          />
        </SliderField>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Appearance</SectionLabel>
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
            value={Number(clip.blur.toFixed(1))}
            suffix="px"
            onChange={(v) => updateClip(clip.id, { blur: v })}
          />
        </SliderField>
        <SliderField label="Brightness">
          <SliderWithValue
            min={0}
            max={200}
            value={Math.round(clip.brightness)}
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
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">{children}</span>
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
