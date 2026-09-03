import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@sohizi/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sohizi/ui/table"
import { Switch } from "@sohizi/ui/switch"
import {
  deleteAdminCommandMutationOptions,
  listAdminCommandsQueryOptions,
  updateAdminCommandMutationOptions,
} from "../query-mutation"
import { CommandFormDialog } from "./command-form-dialog"
import type { AdminCommand } from "../types"

const previewAction = (action: string) =>
  action.length > 80 ? `${action.slice(0, 80)}…` : action

export function CommandsPage() {
  const {
    data: commands = [],
    isLoading,
    error,
  } = useQuery(listAdminCommandsQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminCommand | null>(null)

  const updateMutation = useMutation(updateAdminCommandMutationOptions())
  const deleteMutation = useMutation(deleteAdminCommandMutationOptions())

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (command: AdminCommand) => {
    setEditing(command)
    setDialogOpen(true)
  }

  const handleDelete = (command: AdminCommand) => {
    if (
      !window.confirm(
        `Delete command “${command.name}”? This cannot be undone.`,
      )
    )
      return
    deleteMutation.mutate(command.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commands</h1>
          <p className="text-sm text-muted-foreground">
            Global slash commands available in chat when marked visible.
          </p>
        </div>
        <Button onClick={openCreate}>Add command</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading commands…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load commands</p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Visible</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commands.map((command) => (
              <TableRow key={command.id}>
                <TableCell className="font-mono text-sm">
                  /{command.name}
                </TableCell>
                <TableCell className="max-w-md text-sm text-muted-foreground">
                  {previewAction(command.action)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={command.visible}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({
                        id: command.id,
                        input: { visible: checked },
                      })
                    }
                  />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(command)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(command)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && commands.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No commands yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <CommandFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        command={editing}
      />
    </div>
  )
}
