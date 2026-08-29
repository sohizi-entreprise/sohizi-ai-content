import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  deleteAdminCategoryMutationOptions,
  listAdminCategoriesQueryOptions,
} from '../query-mutation'
import { CategoryFormDialog } from './category-form-dialog'
import type { AdminCategory } from '../types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function ModelCategoriesPage() {
  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery(listAdminCategoriesQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)

  const deleteMutation = useMutation(deleteAdminCategoryMutationOptions())

  const handleDelete = (category: AdminCategory) => {
    const assignmentNote =
      category.modelCount > 0
        ? ` It will be removed from ${category.modelCount} model${category.modelCount === 1 ? '' : 's'}.`
        : ''
    if (
      !window.confirm(
        `Delete category “${category.name}”?${assignmentNote} This cannot be undone.`,
      )
    ) {
      return
    }
    deleteMutation.mutate(category.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Model categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Group models for chat and media generation catalogs.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>Add category</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading categories…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load categories</p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Models</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-mono text-sm">
                  {category.name}
                </TableCell>
                <TableCell className="max-w-md truncate text-sm text-muted-foreground">
                  {category.description || '—'}
                </TableCell>
                <TableCell>{category.modelCount}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(category)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && categories.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <CategoryFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  )
}
