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
import {
  deleteAdminParameterMutationOptions,
  listAdminParametersQueryOptions,
} from '../query-mutation'
import type { AdminParameter } from '../types'
import { ParameterFormDialog } from './parameter-form-dialog'

export function ParametersPage() {
  const { data: parameters = [], isLoading, error } = useQuery(listAdminParametersQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminParameter | null>(null)

  const deleteMutation = useMutation(deleteAdminParameterMutationOptions())

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (parameter: AdminParameter) => {
    setEditing(parameter)
    setDialogOpen(true)
  }

  const handleDelete = (parameter: AdminParameter) => {
    if (!window.confirm(`Delete parameter “${parameter.label}”? This cannot be undone.`)) return
    deleteMutation.mutate(parameter.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Model parameters</h1>
          <p className="text-sm text-muted-foreground">
            Define reusable parameter kinds, then bind them to models with defaults and constraints.
          </p>
        </div>
        <Button onClick={openCreate}>Add parameter</Button>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading parameters…</p> : null}
      {error ? <p className="text-sm text-destructive">Failed to load parameters</p> : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>UI</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parameters.map((parameter) => (
              <TableRow key={parameter.id}>
                <TableCell className="font-medium">{parameter.label}</TableCell>
                <TableCell className="font-mono text-xs">{parameter.key}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{parameter.type}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {parameter.xUiComponent ?? '—'}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(parameter)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(parameter)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && parameters.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No parameters yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ParameterFormDialog open={dialogOpen} onOpenChange={setDialogOpen} parameter={editing} />
    </div>
  )
}
