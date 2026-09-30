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
import { Plus, Trash2 } from "lucide-react"
import type { ShotData, ShotDialogueLine } from "../../extensions/storyboard"

export type ShotFormValues = {
  image: string
  action: string
  narration: string
  dialogue: Array<ShotDialogueLine>
  cameraAngle: string
  cameraMovement: string
}

interface StoryboardShotSheetProps {
  open: boolean
  shot: ShotData | null
  onOpenChange: (open: boolean) => void
  onSubmit: (values: ShotFormValues) => void
}

const EMPTY_VALUES: ShotFormValues = {
  image: "",
  action: "",
  narration: "",
  dialogue: [],
  cameraAngle: "",
  cameraMovement: "",
}

export function StoryboardShotSheet({
  open,
  shot,
  onOpenChange,
  onSubmit,
}: StoryboardShotSheetProps) {
  const [values, setValues] = useState<ShotFormValues>(EMPTY_VALUES)

  useEffect(() => {
    if (!open) return
    if (!shot) {
      // Create mode: start from a blank form.
      setValues(EMPTY_VALUES)
      return
    }
    setValues({
      image: shot.image ?? "",
      action: shot.action ?? "",
      narration: shot.narration ?? "",
      dialogue: shot.dialogue ? shot.dialogue.map((line) => ({ ...line })) : [],
      cameraAngle: shot.camera?.angle ?? "",
      cameraMovement: shot.camera?.movement ?? "",
    })
  }, [open, shot])

  const updateField = <TKey extends keyof ShotFormValues>(
    key: TKey,
    value: ShotFormValues[TKey],
  ) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const updateDialogue = (index: number, patch: Partial<ShotDialogueLine>) => {
    setValues((prev) => ({
      ...prev,
      dialogue: prev.dialogue.map((line, i) =>
        i === index ? { ...line, ...patch } : line,
      ),
    }))
  }

  const addDialogueLine = () => {
    setValues((prev) => ({
      ...prev,
      dialogue: [...prev.dialogue, { speaker: "", text: "" }],
    }))
  }

  const removeDialogueLine = (index: number) => {
    setValues((prev) => ({
      ...prev,
      dialogue: prev.dialogue.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = () => {
    onSubmit({
      ...values,
      dialogue: values.dialogue.filter(
        (line) => line.speaker.trim() || line.text.trim(),
      ),
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Shot details</SheetTitle>
          <SheetDescription>
            Edit the image, action, camera, dialogue and narration for this
            shot.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-4">
          {values.image ? (
            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={values.image}
                alt="Shot preview"
                className="aspect-video w-full object-cover"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="shot-image">Image URL</Label>
            <Input
              id="shot-image"
              value={values.image}
              placeholder="/images/shot.jpg"
              onChange={(event) => updateField("image", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shot-action">Description</Label>
            <Textarea
              id="shot-action"
              value={values.action}
              rows={3}
              placeholder="Describe what happens in this shot..."
              onChange={(event) => updateField("action", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dialogue</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDialogueLine}
              >
                <Plus className="size-3.5" />
                Add line
              </Button>
            </div>
            {values.dialogue.length === 0 ? (
              <p className="text-muted-foreground text-sm">No dialogue.</p>
            ) : (
              <div className="space-y-3">
                {values.dialogue.map((line, index) => (
                  <div key={index} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={line.speaker}
                        placeholder="SPEAKER"
                        onChange={(event) =>
                          updateDialogue(index, { speaker: event.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove line"
                        onClick={() => removeDialogueLine(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={line.text}
                      rows={2}
                      placeholder="Line of dialogue..."
                      onChange={(event) =>
                        updateDialogue(index, { text: event.target.value })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Camera</Label>
            <div className="space-y-2">
              <Label
                htmlFor="shot-camera-angle"
                className="text-muted-foreground font-normal"
              >
                Angle
              </Label>
              <Input
                id="shot-camera-angle"
                value={values.cameraAngle}
                placeholder="low angle, over the shoulder…"
                onChange={(event) =>
                  updateField("cameraAngle", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="shot-camera-movement"
                className="text-muted-foreground font-normal"
              >
                Movement
              </Label>
              <Input
                id="shot-camera-movement"
                value={values.cameraMovement}
                placeholder="slow push in, static…"
                onChange={(event) =>
                  updateField("cameraMovement", event.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="shot-narration">Narration</Label>
            <Textarea
              id="shot-narration"
              value={values.narration}
              rows={2}
              placeholder="Optional voice-over / narration..."
              onChange={(event) => updateField("narration", event.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save shot</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
