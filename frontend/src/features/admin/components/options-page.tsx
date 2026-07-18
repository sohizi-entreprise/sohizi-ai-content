import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import {
  deactivateAdminOptionMutationOptions,
  listAdminOptionsQueryOptions,
  updateAdminOptionMutationOptions,
} from '../query-mutation'
import type { AdminOption } from '../types'
import { OptionFormDialog } from './option-form-dialog'

export function OptionsPage() {
  const { data: options = [], isLoading, error } = useQuery(listAdminOptionsQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminOption | null>(null)

  const updateMutation = useMutation(updateAdminOptionMutationOptions())
  const deactivateMutation = useMutation(deactivateAdminOptionMutationOptions())

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (option: AdminOption) => {
    setEditing(option)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Model options</h1>
          <p className="text-sm text-muted-foreground">
            Configure parameters for media generation models (aspect ratio, duration, voices, etc.).
          </p>
        </div>
        <Button onClick={openCreate}>Add option</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading options…</p> : null}
      {error ? <p className="text-sm text-destructive">Failed to load options</p> : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Models</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {options.map((option) => (
              <TableRow key={option.id}>
                <TableCell className="font-medium">{option.label}</TableCell>
                <TableCell className="font-mono text-xs">{option.key}</TableCell>
                <TableCell>{option.provider}</TableCell>
                <TableCell className="font-mono text-xs">{option.default ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{option.modelIds.length} linked</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={option.active}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({ id: option.id, input: { active: checked } })
                    }
                  />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(option)}>
                    Edit
                  </Button>
                  {option.active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deactivateMutation.mutate(option.id)}
                    >
                      Deactivate
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && options.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No options yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <OptionFormDialog open={dialogOpen} onOpenChange={setDialogOpen} option={editing} />
    </div>
  )
}
