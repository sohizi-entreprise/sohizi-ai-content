import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
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
import { Textarea } from "@sohizi/ui/textarea"
import { createAdminCategoryMutationOptions } from "../query-mutation"
import type { CreateCategoryInput } from "../types"
import { getErrorMessage } from "@/lib/errors"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const emptyForm = {
  name: "",
  description: "",
}

const toKebabCase = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export function CategoryFormDialog({ open, onOpenChange }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createAdminCategoryMutationOptions())

  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setError(null)
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const name = toKebabCase(form.name)
      if (!name) {
        setError("Name must include letters or numbers")
        return
      }
      const payload: CreateCategoryInput = {
        name,
        description: form.description.trim(),
      }
      await createMutation.mutateAsync(payload)
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create category"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add category</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="model-category-name">Name</Label>
            <Input
              id="model-category-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              onBlur={() =>
                setForm((prev) => ({ ...prev, name: toKebabCase(prev.name) }))
              }
              placeholder="text-to-image"
              required
            />
            <p className="text-xs text-muted-foreground">
              Lowercase kebab-case, e.g. text-to-image.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-category-description">Description</Label>
            <Textarea
              id="model-category-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder="Models that generate images from text prompts."
            />
          </div>
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
