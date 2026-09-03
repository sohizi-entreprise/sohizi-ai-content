import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Badge } from "@sohizi/ui/badge"
import { Button } from "@sohizi/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sohizi/ui/table"
import {
  deleteAdminContentCategoryMutationOptions,
  listAdminContentCategoriesQueryOptions,
} from "../query-mutation"
import { ContentCategoryFormDialog } from "./content-category-form-dialog"
import type { AdminContentCategory } from "../types"

export function ContentCategoriesPage() {
  const {
    data: categories = [],
    isLoading,
    error,
  } = useQuery(listAdminContentCategoriesQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminContentCategory | null>(null)

  const deleteMutation = useMutation(
    deleteAdminContentCategoryMutationOptions(),
  )

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (category: AdminContentCategory) => {
    setEditing(category)
    setDialogOpen(true)
  }

  const handleDelete = (category: AdminContentCategory) => {
    if (
      !window.confirm(
        `Delete category “${category.name}”? This cannot be undone.`,
      )
    )
      return
    deleteMutation.mutate(category.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Content categories
          </h1>
          <p className="text-sm text-muted-foreground">
            Taxonomy for skills and projects (genre, format, audience,
            platform).
          </p>
        </div>
        <Button onClick={openCreate}>Add category</Button>
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
              <TableHead>Slug</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {category.slug}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{category.type}</Badge>
                </TableCell>
                <TableCell>{category.displayPriority}</TableCell>
                <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                  {category.description ?? "—"}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(category)}
                  >
                    Edit
                  </Button>
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
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ContentCategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editing}
      />
    </div>
  )
}
