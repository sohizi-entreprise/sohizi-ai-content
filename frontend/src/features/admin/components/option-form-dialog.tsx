import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
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
import {
  createAdminOptionMutationOptions,
  listAdminModelsQueryOptions,
  updateAdminOptionMutationOptions,
} from '../query-mutation'
import type { AdminOption, CreateOptionInput } from '../types'
import {
  choicesToFormState,
  emptyOptionChoicesFormState,
  formStateToChoices,
  OptionChoicesEditor,
  type OptionChoicesFormState,
} from './option-choices-editor'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  option?: AdminOption | null
}

const emptyForm = {
  key: '',
  label: '',
  description: '',
  provider: 'generic',
  active: true,
  modelIds: [] as string[],
}

export function OptionFormDialog({ open, onOpenChange, option }: Props) {
  const isEdit = Boolean(option)
  const [form, setForm] = useState(emptyForm)
  const [choices, setChoices] = useState<OptionChoicesFormState>(emptyOptionChoicesFormState())
  const [error, setError] = useState<string | null>(null)

  const { data: models = [] } = useQuery(listAdminModelsQueryOptions())
  const createMutation = useMutation(createAdminOptionMutationOptions())
  const updateMutation = useMutation(updateAdminOptionMutationOptions())

  useEffect(() => {
    if (!open) return
    if (option) {
      setForm({
        key: option.key,
        label: option.label,
        description: option.description ?? '',
        provider: option.provider,
        active: option.active,
        modelIds: option.modelIds,
      })
      setChoices(choicesToFormState(option.options, option.default))
    } else {
      setForm(emptyForm)
      setChoices(emptyOptionChoicesFormState())
    }
    setError(null)
  }, [open, option])

  const toggleModel = (modelId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      modelIds: checked
        ? [...prev.modelIds, modelId]
        : prev.modelIds.filter((id) => id !== modelId),
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const { options, default: defaultValue } = formStateToChoices(choices)
      const payload: CreateOptionInput = {
        key: form.key,
        label: form.label,
        description: form.description || null,
        provider: form.provider,
        default: defaultValue,
        active: form.active,
        options,
        modelIds: form.modelIds,
      }
      if (isEdit && option) {
        await updateMutation.mutateAsync({ id: option.id, input: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save option')
      setError(message)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit option' : 'Add option'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="option-key">Key</Label>
              <Input
                id="option-key"
                value={form.key}
                onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                placeholder="aspectRatio"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="option-provider">Provider</Label>
              <Input
                id="option-provider"
                value={form.provider}
                onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="option-label">Label</Label>
            <Input
              id="option-label"
              value={form.label}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="option-description">Description</Label>
            <Input
              id="option-description"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="option-active">Active</Label>
            <Switch
              id="option-active"
              checked={form.active}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, active: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Choices</Label>
            <OptionChoicesEditor value={choices} onChange={setChoices} />
          </div>

          <div className="space-y-2">
            <Label>Linked models</Label>
            <div className="grid max-h-48 gap-2 overflow-y-auto rounded-lg border p-3">
              {models.map((model) => (
                <label key={model.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.modelIds.includes(model.id)}
                    onCheckedChange={(checked) => toggleModel(model.id, checked === true)}
                  />
                  <span className="truncate">
                    {model.name} <span className="text-muted-foreground">({model.id})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
