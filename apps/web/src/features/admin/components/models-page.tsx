import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  deleteAdminModelMutationOptions,
  listAdminModelsQueryOptions,
  updateAdminModelMutationOptions,
} from "../query-mutation"
import { ModelFormDialog } from "./model-form-dialog"
import { formatModelPricingLabel } from "./pricing-editor"
import type { AdminModel } from "../types"
import { Badge } from "@sohizi/ui/badge"
import { Button } from "@sohizi/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@sohizi/ui/table"
import { Switch } from "@sohizi/ui/switch"

const ALL_VALUE = "__all__"

export function ModelsPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useQuery(listAdminModelsQueryOptions())
  const models = data?.models ?? []
  const categories = data?.categories ?? []
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState(ALL_VALUE)
  const [providerFilter, setProviderFilter] = useState(ALL_VALUE)

  const updateMutation = useMutation(updateAdminModelMutationOptions())
  const deleteMutation = useMutation(deleteAdminModelMutationOptions())

  const providers = useMemo(() => {
    return [...new Set(models.map((model) => model.provider))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [models])

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesCategory =
        categoryFilter === ALL_VALUE ||
        model.categories.includes(categoryFilter)
      const matchesProvider =
        providerFilter === ALL_VALUE || model.provider === providerFilter
      return matchesCategory && matchesProvider
    })
  }, [models, categoryFilter, providerFilter])

  const openCreate = () => {
    setDialogOpen(true)
  }

  const openEdit = (model: AdminModel) => {
    navigate({ to: "/admin/models/$modelId", params: { modelId: model.id } })
  }

  const handleDelete = (model: AdminModel) => {
    if (!window.confirm(`Delete model “${model.name}”? This cannot be undone.`))
      return
    deleteMutation.mutate(model.id)
  }

  const hasActiveFilters =
    categoryFilter !== ALL_VALUE || providerFilter !== ALL_VALUE

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LLM models</h1>
          <p className="text-sm text-muted-foreground">
            Manage models available to chat and media generation.
          </p>
        </div>
        <Button onClick={openCreate}>Add model</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Category</p>
          <Select
            value={categoryFilter}
            onValueChange={setCategoryFilter}
          >
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem
                  key={category.id}
                  value={category.name}
                >
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Provider</p>
          <Select
            value={providerFilter}
            onValueChange={setProviderFilter}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All providers</SelectItem>
              {providers.map((provider) => (
                <SelectItem
                  key={provider}
                  value={provider}
                >
                  {provider}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategoryFilter(ALL_VALUE)
              setProviderFilter(ALL_VALUE)
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading models…</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">Failed to load models</p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Vendors</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModels.map((model) => (
              <TableRow
                key={model.id}
                className="cursor-pointer"
                onClick={() => openEdit(model)}
              >
                <TableCell className="font-medium">{model.name}</TableCell>
                <TableCell className="font-mono text-xs">{model.id}</TableCell>
                <TableCell>{model.provider}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {model.categories.map((category) => (
                      <Badge
                        key={category}
                        variant="secondary"
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {`${model.vendorCount ?? 0} vendor${(model.vendorCount ?? 0) === 1 ? "" : "s"} · ${formatModelPricingLabel(model.pricing)}`}
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Switch
                    checked={model.enabled}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({
                        id: model.id,
                        input: { enabled: checked },
                      })
                    }
                  />
                </TableCell>
                <TableCell
                  className="space-x-2 text-right"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(model)}
                  >
                    Open
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(model)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filteredModels.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-8 text-center text-muted-foreground"
                >
                  {models.length === 0
                    ? "No models yet."
                    : "No models match these filters."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ModelFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        onCreated={(modelId) =>
          navigate({ to: "/admin/models/$modelId", params: { modelId } })
        }
      />
    </div>
  )
}
