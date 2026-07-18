import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createAdminContentCategoryMutationOptions,
  updateAdminContentCategoryMutationOptions,
} from '../query-mutation'
import type {
  AdminContentCategory,
  ContentCategoryType,
  CreateContentCategoryInput,
} from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: AdminContentCategory | null
}

const CATEGORY_TYPES: ContentCategoryType[] = ['genre', 'format', 'audience', 'platform']

const emptyForm = {
  name: '',
  slug: '',
  type: 'genre' as ContentCategoryType,
  description: '',
  displayPriority: 0,
}

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function ContentCategoryFormDialog({ open, onOpenChange, category }: Props) {
  const isEdit = Boolean(category)
  const [form, setForm] = useState(emptyForm)
  const [slugTouched, setSlugTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createAdminContentCategoryMutationOptions())
  const updateMutation = useMutation(updateAdminContentCategoryMutationOptions())

  useEffect(() => {
    if (!open) return
    if (category) {
      setForm({
        name: category.name,
        slug: category.slug,
        type: category.type,
        description: category.description ?? '',
        displayPriority: category.displayPriority,
      })
      setSlugTouched(true)
    } else {
      setForm(emptyForm)
      setSlugTouched(false)
    }
    setError(null)
  }, [open, category])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const payload: CreateContentCategoryInput = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        type: form.type,
        description: form.description.trim() || null,
        displayPriority: form.displayPriority,
      }
      if (isEdit && category) {
        await updateMutation.mutateAsync({ id: category.id, input: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save category')
      setError(message)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit category' : 'Add category'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={form.name}
              onChange={(event) => {
                const name = event.target.value
                setForm((prev) => ({
                  ...prev,
                  name,
                  slug: slugTouched ? prev.slug : slugify(name),
                }))
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-slug">Slug</Label>
            <Input
              id="category-slug"
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true)
                setForm((prev) => ({ ...prev, slug: event.target.value }))
              }}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, type: value as ContentCategoryType }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-priority">Display priority</Label>
            <Input
              id="category-priority"
              type="number"
              value={form.displayPriority}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  displayPriority: Number(event.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : isEdit ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
