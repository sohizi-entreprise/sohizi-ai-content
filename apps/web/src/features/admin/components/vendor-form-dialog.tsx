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
import { Switch } from "@sohizi/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import {
  createAdminVendorMutationOptions,
  listMediaVendorSlugsQueryOptions,
  updateAdminVendorMutationOptions,
} from "../query-mutation"
import type { AdminVendor, VendorKind } from "../types"
import { getErrorMessage } from "@/lib/errors"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor?: AdminVendor | null
}

const emptyForm = {
  name: "",
  adapter: "",
  kind: "llm" as VendorKind,
  enabled: true,
  rpm: 60,
  burst: 60,
  maxConcurrency: 10,
}

export function VendorFormDialog({ open, onOpenChange, vendor }: Props) {
  const isEdit = Boolean(vendor)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const { data: mediaSlugs } = useQuery(listMediaVendorSlugsQueryOptions())

  const createMutation = useMutation(createAdminVendorMutationOptions())
  const updateMutation = useMutation(updateAdminVendorMutationOptions())

  useEffect(() => {
    if (!open) return
    if (vendor) {
      setForm({
        name: vendor.name,
        adapter: vendor.adapter,
        kind: vendor.kind,
        enabled: vendor.enabled,
        rpm: vendor.rateLimit.rpm,
        burst: vendor.rateLimit.burst ?? vendor.rateLimit.rpm,
        maxConcurrency: vendor.rateLimit.maxConcurrency,
      })
    } else {
      setForm(emptyForm)
    }
    setError(null)
  }, [open, vendor])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const input = {
      name: form.name.trim(),
      adapter:
        form.kind === "media"
          ? form.adapter
          : form.adapter.trim() || form.name.trim(),
      kind: form.kind,
      enabled: form.enabled,
      rateLimit: {
        rpm: form.rpm,
        burst: form.burst,
        maxConcurrency: form.maxConcurrency,
      },
    }
    try {
      if (isEdit && vendor) {
        await updateMutation.mutateAsync({
          id: vendor.id,
          input,
        })
      } else {
        await createMutation.mutateAsync(input)
      }
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save vendor"))
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending
  const slugs = mediaSlugs?.slugs ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="vendor-kind">Kind</Label>
            <Select
              value={form.kind}
              onValueChange={(kind) =>
                setForm((prev) => ({
                  ...prev,
                  kind: kind as VendorKind,
                  adapter:
                    kind === "media" && slugs.length === 1
                      ? slugs[0]
                      : prev.adapter,
                }))
              }
            >
              <SelectTrigger id="vendor-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="llm">LLM</SelectItem>
                <SelectItem value="media">Media</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-name">Name</Label>
            <Input
              id="vendor-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="wavespeed-b"
              required
            />
          </div>
          {form.kind === "media" ? (
            <div className="space-y-2">
              <Label htmlFor="vendor-adapter">Adapter</Label>
              <Select
                value={form.adapter || undefined}
                onValueChange={(adapter) =>
                  setForm((prev) => ({ ...prev, adapter }))
                }
              >
                <SelectTrigger id="vendor-adapter" className="w-full">
                  <SelectValue placeholder="Select adapter" />
                </SelectTrigger>
                <SelectContent>
                  {slugs.map((slug) => (
                    <SelectItem key={slug} value={slug}>
                      {slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {form.kind === "media" ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">
                Runtime capacity limits now live in the capacity registry. These stored values are kept for catalog compatibility and are not used for admission.
              </p>
              <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="vendor-rpm">RPM</Label>
                <Input
                  id="vendor-rpm"
                  type="number"
                  min={1}
                  value={form.rpm}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-burst">Burst</Label>
                <Input
                  id="vendor-burst"
                  type="number"
                  min={1}
                  value={form.burst}
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor-concurrency">Max in-flight</Label>
                <Input
                  id="vendor-concurrency"
                  type="number"
                  min={1}
                  value={form.maxConcurrency}
                  disabled
                />
              </div>
            </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="vendor-enabled">Enabled</Label>
            <Switch
              id="vendor-enabled"
              checked={form.enabled}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, enabled: checked }))
              }
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
            <Button
              type="submit"
              disabled={
                pending || !form.name || (form.kind === "media" && !form.adapter)
              }
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
