import type { ReactNode } from "react"
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { Input } from "@sohizi/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { Textarea } from "@sohizi/ui/textarea"
import { useVideoEditorStore } from "../../store/editor-store"
import { SliderWithValue } from "./slider-with-value"
import type { TextAlign, TextClip } from "../../store/types"
import { cn } from "@/lib/utils"

interface TextSettingsProps {
  clip: TextClip
}

const FONT_FAMILIES: Array<{ id: string; label: string }> = [
  { id: "Inter", label: "Inter" },
  { id: "Roboto", label: "Roboto" },
  { id: "Arial", label: "Arial" },
  { id: "Georgia", label: "Georgia" },
  { id: "Courier New", label: "Courier New" },
]

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

export function TextSettings({ clip }: TextSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const bold = clip.fontWeight === "bold"

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <SectionLabel>Content</SectionLabel>
        <Textarea
          value={clip.text}
          onChange={(e) => updateClip(clip.id, { text: e.target.value })}
          placeholder="Type text..."
          className={cn(
            fieldClassName,
            "field-sizing-fixed h-auto min-h-[88px] resize-none px-3 py-3 text-sm leading-snug",
          )}
        />
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-w-0 flex-col gap-1.5">
            <SectionLabel>Font</SectionLabel>
            <Select
              value={clip.fontFamily}
              onValueChange={(v) => updateClip(clip.id, { fontFamily: v })}
            >
              <SelectTrigger
                size="sm"
                className={cn(fieldClassName, "w-full px-2.5 text-xs")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font.id} value={font.id} className="text-xs">
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5">
            <SectionLabel>Size</SectionLabel>
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
                value={clip.fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!Number.isFinite(v)) return
                  updateClip(clip.id, { fontSize: Math.max(1, v) })
                }}
                className="h-full border-0 bg-transparent px-2.5 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
                aria-label="Font size"
              />
              <span className="shrink-0 text-xs text-muted-foreground">px</span>
            </div>
          </label>
        </div>

        <div
          className={cn(
            fieldClassName,
            "flex items-center gap-0.5 p-0.5 hover:bg-muted/40 dark:hover:bg-muted/25",
          )}
        >
          {ALIGNMENTS.map(({ id, icon: Icon, label }) => {
            const active = clip.align === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => updateClip(clip.id, { align: id })}
                className={cn(
                  "flex h-8 flex-1 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground",
                  active && "bg-background text-foreground shadow-sm",
                )}
              >
                <Icon className="size-3.5" />
              </button>
            )
          })}
          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden />
          <button
            type="button"
            title="Bold"
            aria-label="Bold"
            aria-pressed={bold}
            onClick={() =>
              updateClip(clip.id, { fontWeight: bold ? "normal" : "bold" })
            }
            className={cn(
              "flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-muted-foreground transition-colors hover:text-foreground",
              bold && "text-primary",
            )}
          >
            B
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Style</SectionLabel>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground">Color</span>
          <div
            className={cn(
              fieldClassName,
              "flex w-auto items-center gap-2 pr-2.5 pl-1.5 focus-within:border-foreground focus-within:ring-0",
            )}
          >
            <input
              type="color"
              value={toColorInputValue(clip.color)}
              onChange={(e) => updateClip(clip.id, { color: e.target.value })}
              className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none"
              aria-label="Text color"
            />
            <Input
              value={clip.color}
              onChange={(e) => updateClip(clip.id, { color: e.target.value })}
              spellCheck={false}
              aria-label="Color hex"
              className="h-full w-16 border-0 bg-transparent px-0 font-mono text-xs uppercase shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-foreground">Opacity</span>
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.opacity * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { opacity: v / 100 })}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        <SectionLabel>Position</SectionLabel>
        <PositionControl label="Horizontal">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.xRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { xRatio: v / 100 })}
          />
        </PositionControl>
        <PositionControl label="Vertical">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.yRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { yRatio: v / 100 })}
          />
        </PositionControl>
        <PositionControl label="Width">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(clip.widthRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { widthRatio: v / 100 })}
          />
        </PositionControl>
        <PositionControl label="Height">
          <SliderWithValue
            min={4}
            max={100}
            value={Math.round(clip.heightRatio * 100)}
            suffix="%"
            onChange={(v) => updateClip(clip.id, { heightRatio: v / 100 })}
          />
        </PositionControl>
      </section>
    </div>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-xs font-medium text-muted-foreground">{children}</span>
  )
}

function PositionControl({
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

function toColorInputValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff"
}
