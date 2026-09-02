import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { useVideoEditorStore } from "../../store/editor-store"
import { SettingRow, SettingSection } from "./setting-row"
import { SliderWithValue } from "./slider-with-value"
import type { FontWeight, TextAlign, TextClip } from "../../store/types"
import { Input } from "@sohizi/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { Button } from "@sohizi/ui/button"
import { Textarea } from "@sohizi/ui/textarea"
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

const FONT_WEIGHTS: Array<{ id: FontWeight; label: string }> = [
  { id: "normal", label: "Normal" },
  { id: "bold", label: "Bold" },
]

export function TextSettings({ clip }: TextSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  return (
    <div className="flex flex-col gap-5 pb-2">
      <SettingSection title="Content">
        <SettingRow label="Text" align="start">
          <Textarea
            value={clip.text}
            onChange={(e) => updateClip(clip.id, { text: e.target.value })}
            className="min-h-[72px] text-sm"
            placeholder="Type text..."
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Styles">
        <SettingRow label="Font">
          <Select
            value={clip.fontFamily}
            onValueChange={(v) => updateClip(clip.id, { fontFamily: v })}
          >
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((f) => (
                <SelectItem key={f.id} value={f.id} className="text-xs">
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Weight">
          <Select
            value={String(clip.fontWeight)}
            onValueChange={(v) =>
              updateClip(clip.id, {
                fontWeight: v as FontWeight,
              })
            }
          >
            <SelectTrigger size="sm" className="h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_WEIGHTS.map((w) => (
                <SelectItem
                  key={String(w.id)}
                  value={String(w.id)}
                  className="text-xs"
                >
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label="Size">
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
            className="h-8 text-xs"
          />
        </SettingRow>

        <SettingRow label="Color">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={clip.color}
              onChange={(e) => updateClip(clip.id, { color: e.target.value })}
              className="h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent"
            />
            <Input
              value={clip.color}
              onChange={(e) => updateClip(clip.id, { color: e.target.value })}
              className="h-8 flex-1 text-xs"
            />
          </div>
        </SettingRow>

        <SettingRow label="Align">
          <div className="flex items-center gap-1">
            {(
              [
                { id: "left", icon: AlignLeft },
                { id: "center", icon: AlignCenter },
                { id: "right", icon: AlignRight },
              ] as Array<{
                id: TextAlign
                icon: typeof AlignLeft
              }>
            ).map(({ id, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => updateClip(clip.id, { align: id })}
                className={cn(
                  "size-8 border border-transparent",
                  clip.align === id
                    ? "border-border bg-accent text-foreground"
                    : "text-muted-foreground",
                )}
                title={id}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </SettingRow>

        <SettingRow label="Opacity">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.opacity * 100)}
            onChange={(v) => updateClip(clip.id, { opacity: v / 100 })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Position">
        <SettingRow label="Horizontal">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.xRatio * 100)}
            onChange={(v) => updateClip(clip.id, { xRatio: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Vertical">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.yRatio * 100)}
            onChange={(v) => updateClip(clip.id, { yRatio: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Width">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(clip.widthRatio * 100)}
            onChange={(v) => updateClip(clip.id, { widthRatio: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Height">
          <SliderWithValue
            min={4}
            max={100}
            value={Math.round(clip.heightRatio * 100)}
            onChange={(v) => updateClip(clip.id, { heightRatio: v / 100 })}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}
