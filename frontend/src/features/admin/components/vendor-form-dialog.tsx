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
import {
  createAdminVendorMutationOptions,
  updateAdminVendorMutationOptions,
} from '../query-mutation'
import type { AdminVendor } from '../types'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor?: AdminVendor | null
}

const emptyForm = {
  name: '',
  enabled: true,
}

export function VendorFormDialog({ open, onOpenChange, vendor }: Props) {
  const isEdit = Boolean(vendor)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createAdminVendorMutationOptions())
  const updateMutation = useMutation(updateAdminVendorMutationOptions())

  useEffect(() => {
    if (!open) return
    if (vendor) {
      setForm({ name: vendor.name, enabled: vendor.enabled })
    } else {
      setForm(emptyForm)
    }
    setError(null)
  }, [open, vendor])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      if (isEdit && vendor) {
        await updateMutation.mutateAsync({
          id: vendor.id,
          input: { name: form.name.trim(), enabled: form.enabled },
        })
      } else {
        await createMutation.mutateAsync({
          name: form.name.trim(),
          enabled: form.enabled,
        })
      }
      onOpenChange(false)
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save vendor')
      setError(message)
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit vendor' : 'Add vendor'}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="OpenRouter"
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="vendor-enabled">Enabled</Label>
            <Switch
              id="vendor-enabled"
              checked={form.enabled}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
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
