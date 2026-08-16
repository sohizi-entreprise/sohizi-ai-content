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
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { createAdminModelMutationOptions } from '../query-mutation'
import type { AdminCategoryOption, CreateModelInput } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: AdminCategoryOption[]
  onCreated?: (modelId: string) => void
}

const emptyForm = {
  id: '',
  provider: '',
  name: '',
  apiName: '',
  enabled: true,
  categoryNames: [] as string[],
}

export function ModelFormDialog({ open, onOpenChange, categories, onCreated }: Props) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const createMutation = useMutation(createAdminModelMutationOptions())

  useEffect(() => {
    if (!open) return
    setForm(emptyForm)
    setError(null)
  }, [open])

  const toggleCategory = (name: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      categoryNames: checked
        ? [...prev.categoryNames, name]
        : prev.categoryNames.filter((item) => item !== name),
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const payload: CreateModelInput = {
        id: form.id,
        provider: form.provider,
        name: form.name,
        apiName: form.apiName,
        enabled: form.enabled,
        categoryNames: form.categoryNames,
      }
      const created = await createMutation.mutateAsync(payload)
      onOpenChange(false)
      onCreated?.(created.id)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save model')
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add model</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="model-id">ID</Label>
            <Input
              id="model-id"
              value={form.id}
              placeholder="openai/gpt-5.1"
              onChange={(event) => setForm((prev) => ({ ...prev, id: event.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="model-provider">Provider</Label>
              <Input
                id="model-provider"
                value={form.provider}
                onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model-api-name">API name</Label>
              <Input
                id="model-api-name"
                value={form.apiName}
                onChange={(event) => setForm((prev) => ({ ...prev, apiName: event.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-name">Display name</Label>
            <Input
              id="model-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="model-enabled">Enabled</Label>
            <Switch
              id="model-enabled"
              checked={form.enabled}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.categoryNames.includes(category.name)}
                    onCheckedChange={(checked) => toggleCategory(category.name, checked === true)}
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
