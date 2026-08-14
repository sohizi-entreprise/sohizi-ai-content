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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createAdminParameterMutationOptions,
  updateAdminParameterMutationOptions,
} from '../query-mutation'
import type {
  AdminParameter,
  CreateParameterInput,
  ModelParameterDataType,
  ModelParameterUIComponent,
} from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  parameter?: AdminParameter | null
}

const PARAMETER_TYPES: ModelParameterDataType[] = [
  'string',
  'number',
  'boolean',
  'array<string>',
  'array<number>',
]

const UI_COMPONENTS: ModelParameterUIComponent[] = ['select', 'slider', 'uploader']
const NONE_VALUE = '__none__'

const emptyForm = {
  key: '',
  label: '',
  type: 'string' as ModelParameterDataType,
  description: '',
  xUiComponent: '' as ModelParameterUIComponent | '',
}

export function ParameterFormDialog({ open, onOpenChange, parameter }: Props) {
  const isEdit = Boolean(parameter)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createAdminParameterMutationOptions())
  const updateMutation = useMutation(updateAdminParameterMutationOptions())

  useEffect(() => {
    if (!open) return
    if (parameter) {
      setForm({
        key: parameter.key,
        label: parameter.label,
        type: parameter.type,
        description: parameter.description ?? '',
        xUiComponent: parameter.xUiComponent ?? '',
      })
    } else {
      setForm(emptyForm)
    }
    setError(null)
  }, [open, parameter])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const payload: CreateParameterInput = {
        key: form.key,
        label: form.label,
        type: form.type,
        description: form.description || null,
        xUiComponent: form.xUiComponent || null,
      }
      if (isEdit && parameter) {
        await updateMutation.mutateAsync({ id: parameter.id, input: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save parameter')
      setError(message)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit parameter' : 'Add parameter'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="parameter-key">Key</Label>
              <Input
                id="parameter-key"
                value={form.key}
                onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                placeholder="aspectRatio"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parameter-label">Label</Label>
              <Input
                id="parameter-label"
                value={form.label}
                onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
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
                  setForm((prev) => ({ ...prev, type: value as ModelParameterDataType }))
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
                    xUiComponent: value === NONE_VALUE ? '' : (value as ModelParameterUIComponent),
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
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
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
