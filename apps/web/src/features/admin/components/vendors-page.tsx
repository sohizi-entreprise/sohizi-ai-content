import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import {
  deleteAdminVendorMutationOptions,
  listAdminVendorsQueryOptions,
  updateAdminVendorMutationOptions,
} from "../query-mutation"
import { VendorFormDialog } from "./vendor-form-dialog"
import type { AdminVendor } from "../types"
import { Button } from "@sohizi/ui/button"
import { Switch } from "@sohizi/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sohizi/ui/table"

export function VendorsPage() {
  const {
    data: vendors = [],
    isLoading,
    error,
  } = useQuery(listAdminVendorsQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminVendor | null>(null)

  const updateMutation = useMutation(updateAdminVendorMutationOptions())
  const deleteMutation = useMutation(deleteAdminVendorMutationOptions())

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (vendor: AdminVendor) => {
    setEditing(vendor)
    setDialogOpen(true)
  }

  const handleDelete = (vendor: AdminVendor) => {
    const assignmentNote =
      vendor.modelCount > 0
        ? ` It will be removed from ${vendor.modelCount} model${vendor.modelCount === 1 ? "" : "s"}.`
        : ""
    if (
      !window.confirm(
        `Delete vendor “${vendor.name}”?${assignmentNote} This cannot be undone.`,
      )
    ) {
      return
    }
    deleteMutation.mutate(vendor.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">
            Providers that serve models and map parameter option values.
          </p>
        </div>
        <Button onClick={openCreate}>Add vendor</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading vendors…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load vendors</p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Models</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell className="font-medium">{vendor.name}</TableCell>
                <TableCell>{vendor.kind}</TableCell>
                <TableCell>{vendor.modelCount}</TableCell>
                <TableCell>
                  <Switch
                    checked={vendor.enabled}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({
                        id: vendor.id,
                        input: { enabled: checked },
                      })
                    }
                  />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(vendor)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(vendor)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && vendors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No vendors yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <VendorFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendor={editing}
      />
    </div>
  )
}
