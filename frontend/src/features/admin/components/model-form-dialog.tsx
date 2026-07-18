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
  createAdminModelMutationOptions,
  listAdminCategoriesQueryOptions,
  updateAdminModelMutationOptions,
} from '../query-mutation'
import type { AdminModel, CreateModelInput } from '../types'
import {
  emptyPricingFormState,
  formStateToPricing,
  PricingEditor,
  pricingToFormState,
  type PricingFormState,
} from './pricing-editor'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  model?: AdminModel | null
}

const emptyForm = {
  id: '',
  provider: '',
  name: '',
  apiName: '',
  enabled: true,
  categoryNames: [] as string[],
}

export function ModelFormDialog({ open, onOpenChange, model }: Props) {
  const isEdit = Boolean(model)
  const [form, setForm] = useState(emptyForm)
  const [pricing, setPricing] = useState<PricingFormState>(emptyPricingFormState())
  const [error, setError] = useState<string | null>(null)

  const { data: categories = [] } = useQuery(listAdminCategoriesQueryOptions())
  const createMutation = useMutation(createAdminModelMutationOptions())
  const updateMutation = useMutation(updateAdminModelMutationOptions())

  useEffect(() => {
    if (!open) return
    if (model) {
      setForm({
        id: model.id,
        provider: model.provider,
        name: model.name,
        apiName: model.apiName,
        enabled: model.enabled,
        categoryNames: model.categories,
      })
      setPricing(pricingToFormState(model.pricing))
    } else {
      setForm(emptyForm)
      setPricing(emptyPricingFormState())
    }
    setError(null)
  }, [open, model])

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
      const pricingPayload = formStateToPricing(pricing)
      if (isEdit && model) {
        await updateMutation.mutateAsync({
          id: model.id,
          input: {
            provider: form.provider,
            name: form.name,
            apiName: form.apiName,
            enabled: form.enabled,
            categoryNames: form.categoryNames,
            pricing: pricingPayload,
          },
        })
      } else {
        const payload: CreateModelInput = {
          id: form.id,
          provider: form.provider,
          name: form.name,
          apiName: form.apiName,
          enabled: form.enabled,
          categoryNames: form.categoryNames,
          pricing: pricingPayload,
        }
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save model')
      setError(message)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit model' : 'Add model'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="model-id">ID</Label>
            <Input
              id="model-id"
              value={form.id}
              disabled={isEdit}
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
          <PricingEditor value={pricing} onChange={setPricing} />
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
