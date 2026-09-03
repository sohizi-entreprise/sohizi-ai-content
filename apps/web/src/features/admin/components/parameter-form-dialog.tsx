import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { createAdminParameterMutationOptions } from "../query-mutation"
import type {
  CreateParameterInput,
  CreateParameterOptionInput,
  ModelParameterDataType,
  ModelParameterUIComponent,
} from "../types"
import { getErrorMessage } from "@/lib/errors"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (parameterId: string) => void
}

const PARAMETER_TYPES: Array<ModelParameterDataType> = [
  "string",
  "number",
  "boolean",
  "array<string>",
  "array<number>",
]

const UI_COMPONENTS: Array<ModelParameterUIComponent> = [
  "select",
  "slider",
  "uploader",
]
const NONE_VALUE = "__none__"

const emptyForm = {
  key: "",
  label: "",
  type: "string" as ModelParameterDataType,
  description: "",
  xUiComponent: "" as ModelParameterUIComponent | "",
}

const emptyOption = (): CreateParameterOptionInput => ({
  label: "",
  value: "",
  description: "",
})

export function ParameterFormDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [options, setOptions] = useState<Array<CreateParameterOptionInput>>([
    emptyOption(),
  ])
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createAdminParameterMutationOptions())

  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setOptions([emptyOption()])
    setError(null)
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const seededOptions = options
        .map((option) => ({
          label: option.label.trim(),
          value: option.value.trim(),
          description: option.description?.trim() || null,
        }))
        .filter((option) => option.label && option.value)

      const payload: CreateParameterInput = {
        key: form.key,
        label: form.label,
        type: form.type,
        description: form.description || null,
        xUiComponent: form.xUiComponent || null,
        ...(form.xUiComponent === "select" && seededOptions.length > 0
          ? { options: seededOptions }
          : {}),
      }
      const created = await createMutation.mutateAsync(payload)
      onOpenChange(false)
      onCreated?.(created.id)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save parameter"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add parameter</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="parameter-key">Key</Label>
              <Input
                id="parameter-key"
                value={form.key}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, key: event.target.value }))
                }
                placeholder="aspectRatio"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parameter-label">Label</Label>
              <Input
                id="parameter-label"
                value={form.label}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, label: event.target.value }))
                }
                placeholder="Aspect ratio"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    type: value as ModelParameterDataType,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARAMETER_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>UI component</Label>
              <Select
                value={form.xUiComponent || NONE_VALUE}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    xUiComponent:
                      value === NONE_VALUE
                        ? ""
                        : (value as ModelParameterUIComponent),
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>None</SelectItem>
                  {UI_COMPONENTS.map((component) => (
                    <SelectItem key={component} value={component}>
                      {component}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parameter-description">Description</Label>
            <Input
              id="parameter-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </div>
          {form.xUiComponent === "select" ? (
            <div className="space-y-2">
              <Label>Initial options</Label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2"
                  >
                    <Input
                      value={option.label}
                      placeholder="Label"
                      onChange={(event) =>
                        setOptions((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Input
                      value={option.value}
                      placeholder="Value"
                      onChange={(event) =>
                        setOptions((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={options.length <= 1}
                      onClick={() =>
                        setOptions((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      aria-label="Remove option"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOptions((prev) => [...prev, emptyOption()])}
                >
                  <Plus className="size-4" />
                  Add option
                </Button>
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
