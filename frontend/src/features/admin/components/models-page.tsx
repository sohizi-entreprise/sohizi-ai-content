import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  disableAdminModelMutationOptions,
  listAdminCategoriesQueryOptions,
  listAdminModelsQueryOptions,
  updateAdminModelMutationOptions,
} from '../query-mutation'
import type { AdminModel } from '../types'
import { ModelFormDialog } from './model-form-dialog'

const ALL_VALUE = '__all__'

export function ModelsPage() {
  const { data: models = [], isLoading, error } = useQuery(listAdminModelsQueryOptions())
  const { data: categories = [] } = useQuery(listAdminCategoriesQueryOptions())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AdminModel | null>(null)
  const [categoryFilter, setCategoryFilter] = useState(ALL_VALUE)
  const [providerFilter, setProviderFilter] = useState(ALL_VALUE)

  const updateMutation = useMutation(updateAdminModelMutationOptions())
  const disableMutation = useMutation(disableAdminModelMutationOptions())

  const providers = useMemo(() => {
    return [...new Set(models.map((model) => model.provider))].sort((a, b) =>
      a.localeCompare(b),
    )
  }, [models])

  const filteredModels = useMemo(() => {
    return models.filter((model) => {
      const matchesCategory =
        categoryFilter === ALL_VALUE || model.categories.includes(categoryFilter)
      const matchesProvider =
        providerFilter === ALL_VALUE || model.provider === providerFilter
      return matchesCategory && matchesProvider
    })
  }, [models, categoryFilter, providerFilter])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (model: AdminModel) => {
    setEditing(model)
    setDialogOpen(true)
  }

  const hasActiveFilters = categoryFilter !== ALL_VALUE || providerFilter !== ALL_VALUE

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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.name}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Provider</p>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All providers</SelectItem>
              {providers.map((provider) => (
                <SelectItem key={provider} value={provider}>
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

      {isLoading ? <p className="text-sm text-muted-foreground">Loading models…</p> : null}
      {error ? <p className="text-sm text-destructive">Failed to load models</p> : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Categories</TableHead>
              <TableHead>Pricing</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredModels.map((model) => (
              <TableRow key={model.id}>
                <TableCell className="font-medium">{model.name}</TableCell>
                <TableCell className="font-mono text-xs">{model.id}</TableCell>
                <TableCell>{model.provider}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {model.categories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {model.pricing ? 'Configured' : '—'}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={model.enabled}
                    onCheckedChange={(checked) =>
                      updateMutation.mutate({ id: model.id, input: { enabled: checked } })
                    }
                  />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(model)}>
                    Edit
                  </Button>
                  {model.enabled ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => disableMutation.mutate(model.id)}
                    >
                      Disable
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filteredModels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {models.length === 0 ? 'No models yet.' : 'No models match these filters.'}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <ModelFormDialog open={dialogOpen} onOpenChange={setDialogOpen} model={editing} />
    </div>
  )
}
