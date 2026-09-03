import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
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
import { Checkbox } from "@sohizi/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import {
  createAdminSkillMutationOptions,
  listAdminContentCategoriesQueryOptions,
  updateAdminSkillMutationOptions,
} from "../query-mutation"
import type {
  AdminSkill,
  CreateSkillInput,
  SkillStatus,
  SkillVisibility,
} from "../types"
import { getErrorMessage } from "@/lib/errors"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: AdminSkill | null
}

const emptyForm = {
  name: "",
  description: "",
  instructions: "",
  status: "draft" as SkillStatus,
  visibility: "private" as SkillVisibility,
  categoryIds: [] as Array<string>,
}

export function SkillFormDialog({ open, onOpenChange, skill }: Props) {
  const isEdit = Boolean(skill)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const { data: categories = [] } = useQuery(
    listAdminContentCategoriesQueryOptions(),
  )
  const createMutation = useMutation(createAdminSkillMutationOptions())
  const updateMutation = useMutation(updateAdminSkillMutationOptions())

  useEffect(() => {
    if (!open) return
    if (skill) {
      setForm({
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        status: skill.status,
        visibility: skill.visibility,
        categoryIds: skill.categoryIds,
      })
    } else {
      setForm(emptyForm)
    }
    setError(null)
  }, [open, skill])

  const toggleCategory = (categoryId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: checked
        ? [...prev.categoryIds, categoryId]
        : prev.categoryIds.filter((id) => id !== categoryId),
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const payload: CreateSkillInput = {
        name: form.name.trim(),
        description: form.description.trim(),
        instructions: form.instructions.trim(),
        status: form.status,
        visibility: form.visibility,
        categoryIds: form.categoryIds,
      }
      if (isEdit && skill) {
        await updateMutation.mutateAsync({ id: skill.id, input: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save skill"))
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit skill" : "Add skill"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-description">Description</Label>
            <Textarea
              id="skill-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={2}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skill-instructions">Instructions</Label>
            <Textarea
              id="skill-instructions"
              value={form.instructions}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  instructions: event.target.value,
                }))
              }
              rows={8}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((prev) => ({ ...prev, status: value as SkillStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">draft</SelectItem>
                  <SelectItem value="published">published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    visibility: value as SkillVisibility,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">private</SelectItem>
                  <SelectItem value="public">public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No content categories yet.
                </p>
              ) : (
                categories.map((category) => (
                  <label
                    key={category.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={form.categoryIds.includes(category.id)}
                      onCheckedChange={(checked) =>
                        toggleCategory(category.id, checked === true)
                      }
                    />
                    <span>
                      {category.name}{" "}
                      <span className="text-muted-foreground">
                        ({category.type})
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
