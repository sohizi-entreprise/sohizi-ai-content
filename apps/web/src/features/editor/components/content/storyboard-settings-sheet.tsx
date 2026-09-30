import { useEffect, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@sohizi/ui/sheet"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { Textarea } from "@sohizi/ui/textarea"
import { Label } from "@sohizi/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { Plus, Trash2 } from "lucide-react"
import {
  DEFAULT_STORYBOARD_SETTINGS,
  STORYBOARD_ASPECT_RATIOS,
  parseAspectRatio,
} from "../../extensions/storyboard"
import type {
  StoryboardAspectRatio,
  StoryboardSettings,
} from "../../extensions/storyboard"

export type SettingsFormValues = StoryboardSettings

interface StoryboardSettingsSheetProps {
  open: boolean
  settings: StoryboardSettings
  onOpenChange: (open: boolean) => void
  onSubmit: (values: SettingsFormValues) => void
}

const DEFAULT_SWATCH = "#808080"

function collapseLine(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

export function StoryboardSettingsSheet({
  open,
  settings,
  onOpenChange,
  onSubmit,
}: StoryboardSettingsSheetProps) {
  const [values, setValues] = useState<SettingsFormValues>(
    DEFAULT_STORYBOARD_SETTINGS,
  )

  useEffect(() => {
    if (!open) return
    setValues({
      aspectRatio: parseAspectRatio(settings.aspectRatio),
      visualStyle: settings.visualStyle,
      colorPalette: [...settings.colorPalette],
      temporalContext: settings.temporalContext,
    })
  }, [open, settings])

  const updateField = <TKey extends keyof SettingsFormValues>(
    key: TKey,
    value: SettingsFormValues[TKey],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const updateColor = (index: number, value: string) => {
    setValues((prev) => ({
      ...prev,
      colorPalette: prev.colorPalette.map((color, i) =>
        i === index ? value : color,
      ),
    }))
  }

  const addColor = () => {
    setValues((prev) => ({
      ...prev,
      colorPalette: [...prev.colorPalette, DEFAULT_SWATCH],
    }))
  }

  const removeColor = (index: number) => {
    setValues((prev) => ({
      ...prev,
      colorPalette: prev.colorPalette.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = () => {
    onSubmit({
      aspectRatio: parseAspectRatio(values.aspectRatio),
      visualStyle: collapseLine(values.visualStyle),
      colorPalette: values.colorPalette
        .map((color) => color.trim())
        .filter(Boolean),
      temporalContext: collapseLine(values.temporalContext),
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>World bible</SheetTitle>
          <SheetDescription>
            Shared look, palette, and time period for every scene in this
            storyboard.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="world-aspect">Frame aspect ratio</Label>
            <Select
              value={values.aspectRatio}
              onValueChange={(value) =>
                updateField("aspectRatio", value as StoryboardAspectRatio)
              }
            >
              <SelectTrigger id="world-aspect" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORYBOARD_ASPECT_RATIOS.map((ratio) => (
                  <SelectItem key={ratio} value={ratio}>
                    {ratio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="world-style">Visual style</Label>
            <Textarea
              id="world-style"
              value={values.visualStyle}
              rows={3}
              placeholder="Shared visual language for the whole storyboard…"
              onChange={(event) =>
                updateField("visualStyle", event.target.value)
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Color palette</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addColor}
              >
                <Plus className="size-3.5" />
                Add color
              </Button>
            </div>
            {values.colorPalette.length === 0 ? (
              <p className="text-muted-foreground text-sm">No colors yet.</p>
            ) : (
              <div className="space-y-2">
                {values.colorPalette.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={swatchValue(color)}
                      aria-label={`Palette color ${index + 1}`}
                      onChange={(event) =>
                        updateColor(index, event.target.value)
                      }
                      className="h-9 w-10 cursor-pointer rounded-md border border-input bg-transparent"
                    />
                    <Input
                      value={color}
                      placeholder="#1a1a1a"
                      onChange={(event) =>
                        updateColor(index, event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove color"
                      onClick={() => removeColor(index)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="world-time">Temporal context</Label>
            <Textarea
              id="world-time"
              value={values.temporalContext}
              rows={2}
              placeholder="When this story takes place…"
              onChange={(event) =>
                updateField("temporalContext", event.target.value)
              }
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save world</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function swatchValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_SWATCH
}
