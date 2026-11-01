import type { ReactNode } from "react"
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { Input } from "@sohizi/ui/input"
import { Switch } from "@sohizi/ui/switch"
import { useVideoEditorStore } from "../../store/editor-store"
import { SliderWithValue } from "./slider-with-value"
import { formatCaptionTimestamp, groupCaptionBlocks } from "./caption-blocks"
import type { CaptionClip, TextAlign } from "../../store/types"
import { cn } from "@/lib/utils"

const ALIGNMENTS: Array<{
  id: TextAlign
  icon: typeof AlignLeft
  label: string
}> = [
  { id: "left", icon: AlignLeft, label: "Align left" },
  { id: "center", icon: AlignCenter, label: "Align center" },
  { id: "right", icon: AlignRight, label: "Align right" },
]

const fieldClassName =
  "h-9 rounded-xl border border-border/80 bg-muted/40 text-sm shadow-none hover:bg-muted/70 focus-visible:border-foreground focus-visible:ring-0 dark:bg-muted/25 dark:hover:bg-muted/40"

export function CaptionSettings({ clip }: { clip: CaptionClip }) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const properties = clip.properties
  const blocks = groupCaptionBlocks(clip.captions.words)

  const patch = (next: Partial<CaptionClip["properties"]>) => {
    updateClip(clip.id, { properties: { ...properties, ...next } })
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3">
        <SectionLabel>Style</SectionLabel>
        <label className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Size</span>
          <div
            className={cn(
              fieldClassName,
              "flex items-center pr-2.5 focus-within:border-foreground focus-within:ring-0",
            )}
          >
            <Input
              type="number"
              min={8}
              max={400}
              value={properties.fontSize}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (!Number.isFinite(value)) return
                patch({ fontSize: Math.max(1, value) })
              }}
              className="h-full border-0 bg-transparent px-2.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
              aria-label="Font size"
            />
            <span className="shrink-0 text-xs text-muted-foreground">px</span>
          </div>
        </label>

        <div
          className={cn(
            fieldClassName,
            "flex items-center gap-0.5 p-0.5 hover:bg-muted/40 dark:hover:bg-muted/25",
          )}
        >
          {ALIGNMENTS.map(({ id, icon: Icon, label }) => {
            const active = properties.align === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => patch({ align: id })}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-background text-foreground shadow-sm",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            )
          })}
        </div>

        <ColorRow
          label="Color"
          value={properties.color}
          onChange={(color) => patch({ color })}
        />
        <ColorRow
          label="Highlight"
          value={properties.hightlightColor ?? "#FFD700"}
          onChange={(hightlightColor) => patch({ hightlightColor })}
        />
        <BackgroundRow
          enabled={properties.backgroundEnabled !== false}
          color={properties.backgroundColor ?? "#000000"}
          onEnabledChange={(backgroundEnabled) => patch({ backgroundEnabled })}
          onColorChange={(backgroundColor) => patch({ backgroundColor })}
        />
        <SliderField label="Opacity">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(properties.opacity * 100)}
            suffix="%"
            onChange={(value) => patch({ opacity: value / 100 })}
          />
        </SliderField>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Position</SectionLabel>
        <SliderField label="Horizontal">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(properties.xRatio * 100)}
            suffix="%"
            onChange={(value) => patch({ xRatio: value / 100 })}
          />
        </SliderField>
        <SliderField label="Vertical">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(properties.yRatio * 100)}
            suffix="%"
            onChange={(value) => patch({ yRatio: value / 100 })}
          />
        </SliderField>
        <SliderField label="Width">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(properties.widthRatio * 100)}
            suffix="%"
            onChange={(value) => patch({ widthRatio: value / 100 })}
          />
        </SliderField>
      </section>

      <section className="flex flex-col gap-2 border-t border-border/60 pt-4">
        <SectionLabel>Transcript</SectionLabel>
        {blocks.length === 0 ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {clip.captions.text || "This caption has no transcript yet."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blocks.map((block) => (
              <div
                key={`${block.start}-${block.end}`}
                className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5"
              >
                <p className="font-mono text-[11px] text-muted-foreground">
                  {formatCaptionTimestamp(block.start)} –{" "}
                  {formatCaptionTimestamp(block.end)}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed wrap-break-word text-foreground">
                  {block.text}
                </p>
              </div>
            ))}
          </div>
        )}
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

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <div
        className={cn(
          fieldClassName,
          "flex w-auto items-center gap-2 pr-2.5 pl-1.5 focus-within:border-foreground focus-within:ring-0",
        )}
      >
        <input
          type="color"
          value={toColorInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
          className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
          aria-label={`${label} color`}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-label={`${label} hex`}
          className="h-full w-16 border-0 bg-transparent px-0 font-mono text-xs uppercase shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </div>
    </div>
  )
}

function BackgroundRow({
  enabled,
  color,
  onEnabledChange,
  onColorChange,
}: {
  enabled: boolean
  color: string
  onEnabledChange: (enabled: boolean) => void
  onColorChange: (color: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">Background</span>
      <div className="flex items-center gap-2">
        {enabled ? (
          <div
            className={cn(
              fieldClassName,
              "flex w-auto items-center gap-2 pr-2.5 pl-1.5 focus-within:border-foreground focus-within:ring-0",
            )}
          >
            <input
              type="color"
              value={toColorInputValue(color)}
              onChange={(e) => onColorChange(e.target.value)}
              className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
              aria-label="Background color"
            />
            <Input
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              spellCheck={false}
              aria-label="Background hex"
              className="h-full w-16 border-0 bg-transparent px-0 font-mono text-xs uppercase shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        ) : null}
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label="Toggle caption background"
          className="focus-visible:ring-1 focus-visible:ring-foreground/30"
        />
      </div>
    </div>
  )
}

function toColorInputValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff"
}
