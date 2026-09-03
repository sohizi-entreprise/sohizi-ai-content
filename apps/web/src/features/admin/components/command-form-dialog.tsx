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
import { Switch } from "@sohizi/ui/switch"
import { Textarea } from "@sohizi/ui/textarea"
import {
  createAdminCommandMutationOptions,
  updateAdminCommandMutationOptions,
} from "../query-mutation"
import type { AdminCommand, CreateCommandInput } from "../types"
import { getErrorMessage } from "@/lib/errors"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  command?: AdminCommand | null
}

const emptyForm = {
  name: "",
  action: "",
  visible: false,
}

export function CommandFormDialog({ open, onOpenChange, command }: Props) {
  const isEdit = Boolean(command)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createAdminCommandMutationOptions())
  const updateMutation = useMutation(updateAdminCommandMutationOptions())

  useEffect(() => {
    if (!open) return
    if (command) {
      setForm({
        name: command.name,
        action: command.action,
        visible: command.visible,
      })
    } else {
      setForm(emptyForm)
    }
    setError(null)
  }, [open, command])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      const payload: CreateCommandInput = {
        name: form.name.trim(),
        action: form.action.trim(),
        visible: form.visible,
      }
      if (isEdit && command) {
        await updateMutation.mutateAsync({ id: command.id, input: payload })
      } else {
        await createMutation.mutateAsync(payload)
      }
      onOpenChange(false)
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save command"))
    }
  }

  const pending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit command" : "Add command"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="command-name">Name</Label>
            <Input
              id="command-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="summarize"
              required
            />
            <p className="text-xs text-muted-foreground">
              Slash-friendly name (letters, numbers, - or _)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="command-action">Action</Label>
            <Textarea
              id="command-action"
              value={form.action}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, action: event.target.value }))
              }
              placeholder="Instruction injected when this command is invoked"
              rows={6}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="command-visible">Visible</Label>
              <p className="text-xs text-muted-foreground">
                When on, users can discover and invoke this command
              </p>
            </div>
            <Switch
              id="command-visible"
              checked={form.visible}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, visible: checked }))
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
