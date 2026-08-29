import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import {
  createModelVendorBindingMutationOptions,
  deleteModelVendorBindingMutationOptions,
  getAdminModelQueryOptions,
  listAdminCategoriesQueryOptions,
  listAdminParametersQueryOptions,
  listAdminVendorsQueryOptions,
  listModelParametersQueryOptions,
  replaceModelParametersMutationOptions,
  updateAdminModelMutationOptions,
  updateModelVendorBindingMutationOptions,
} from '../query-mutation'
import {
  ModelParametersEditor,
  bindingsToDrafts,
  draftsToPayload,
} from './model-parameters-editor'
import {
  PricingEditor,
  formStateToPricing,
  pricingToFormState,
} from './pricing-editor'
import type { ParameterBindingDraft } from './model-parameters-editor'
import type { PricingFormState } from './pricing-editor'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Props = {
  modelId: string
}

const EMPTY_LIST: Array<never> = []

export function ModelDetailPage({ modelId }: Props) {
  const {
    data: model,
    isLoading,
    error,
  } = useQuery(getAdminModelQueryOptions(modelId))
  const { data: categories = EMPTY_LIST } = useQuery(
    listAdminCategoriesQueryOptions(),
  )
  const { data: catalog = EMPTY_LIST } = useQuery(
    listAdminParametersQueryOptions(),
  )
  const { data: existingBindings } = useQuery(
    listModelParametersQueryOptions(modelId),
  )
  const { data: vendors = EMPTY_LIST } = useQuery(
    listAdminVendorsQueryOptions(),
  )

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading model…</p>
  }
  if (error || !model) {
    return <p className="text-sm text-destructive">Failed to load model</p>
  }

  return (
    <ModelDetailForm
      key={model.id}
      model={model}
      categories={categories}
      catalog={catalog}
      existingBindings={existingBindings}
      vendors={vendors}
    />
  )
}

function ModelDetailForm({
  model,
  categories,
  catalog,
  existingBindings,
  vendors,
}: {
  model: {
    id: string
    provider: string
    name: string
    description: string | null
    enabled: boolean
    pricing?: Parameters<typeof pricingToFormState>[0]
    categories: Array<string>
    vendors: Array<{
      vendorId: string
      name: string
      apiName: string
      enabled: boolean
      priority: number
    }>
  }
  categories: Array<{ id: string; name: string }>
  catalog: Parameters<typeof bindingsToDrafts>[1]
  existingBindings: Parameters<typeof bindingsToDrafts>[0] | undefined
  vendors: Array<{ id: string; name: string }>
}) {
  const [form, setForm] = useState({
    provider: model.provider,
    name: model.name,
    description: model.description ?? '',
    enabled: model.enabled,
    categoryNames: model.categories,
  })
  const [pricing, setPricing] = useState<PricingFormState>(() =>
    pricingToFormState(model.pricing),
  )
  const [bindings, setBindings] = useState<Array<ParameterBindingDraft>>(() =>
    existingBindings ? bindingsToDrafts(existingBindings, catalog) : [],
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const hydratedBindingsFor = useRef<string | null>(
    existingBindings ? model.id : null,
  )

  const updateMutation = useMutation(updateAdminModelMutationOptions())
  const replaceParametersMutation = useMutation(
    replaceModelParametersMutationOptions(),
  )

  useEffect(() => {
    if (!existingBindings) return
    if (hydratedBindingsFor.current === model.id) {
      setBindings((prev) => {
        const next = prev.map((draft) => {
          const catalogParameter = catalog.find(
            (item) => item.id === draft.parameterId,
          )
          if (
            !catalogParameter ||
            draft.catalogOptions === catalogParameter.options
          ) {
            return draft
          }
          return { ...draft, catalogOptions: catalogParameter.options }
        })
        return next.some((draft, index) => draft !== prev[index]) ? next : prev
      })
      return
    }
    hydratedBindingsFor.current = model.id
    setBindings(bindingsToDrafts(existingBindings, catalog))
  }, [model.id, existingBindings, catalog])

  const toggleCategory = (name: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      categoryNames: checked
        ? [...prev.categoryNames, name]
        : prev.categoryNames.filter((item) => item !== name),
    }))
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaveError(null)
    try {
      const parameterPayload = draftsToPayload(bindings)
      await updateMutation.mutateAsync({
        id: model.id,
        input: {
          provider: form.provider,
          name: form.name,
          description: form.description.trim() || null,
          enabled: form.enabled,
          categoryNames: form.categoryNames,
          pricing: formStateToPricing(pricing),
        },
      })
      await replaceParametersMutation.mutateAsync({
        modelId: model.id,
        input: parameterPayload,
      })
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to save model'))
    }
  }

  const pending =
    updateMutation.isPending || replaceParametersMutation.isPending

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/admin/models"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Models
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {model.name}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">{model.id}</p>
      </div>

      <form className="space-y-6" onSubmit={handleSave}>
        <section className="space-y-4 rounded-xl border p-4">
          <h2 className="text-sm font-medium">Details</h2>
          <div className="space-y-2">
            <Label htmlFor="model-provider">Provider</Label>
            <Input
              id="model-provider"
              value={form.provider}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, provider: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-name">Display name</Label>
            <Input
              id="model-name"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-description">Description</Label>
            <Textarea
              id="model-description"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              placeholder="Optional summary of what this model is for."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="model-enabled">Enabled</Label>
            <Switch
              id="model-enabled"
              checked={form.enabled}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, enabled: checked }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={form.categoryNames.includes(category.name)}
                    onCheckedChange={(checked) =>
                      toggleCategory(category.name, checked === true)
                    }
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border p-4">
          <h2 className="text-sm font-medium">Pricing</h2>
          <p className="text-sm text-muted-foreground">
            Listed rates for this model. Option multipliers on parameters below
            adjust this base rate.
          </p>
          <PricingEditor value={pricing} onChange={setPricing} />
        </section>

        <section className="space-y-4 rounded-xl border p-4">
          <ModelParametersEditor
            value={bindings}
            onChange={setBindings}
            catalog={catalog}
          />
        </section>

        {saveError ? (
          <p className="text-sm text-destructive">{saveError}</p>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save model'}
        </Button>
      </form>

      <ModelVendorsSection
        modelId={model.id}
        boundVendors={model.vendors}
        vendors={vendors}
      />
    </div>
  )
}

function ModelVendorsSection({
  modelId,
  boundVendors,
  vendors,
}: {
  modelId: string
  boundVendors: Array<{
    vendorId: string
    name: string
    apiName: string
    enabled: boolean
    priority: number
  }>
  vendors: Array<{ id: string; name: string }>
}) {
  const unusedVendors = vendors.filter(
    (vendor) => !boundVendors.some((binding) => binding.vendorId === vendor.id),
  )
  const [vendorId, setVendorId] = useState('')
  const [apiName, setApiName] = useState('')
  const [priority, setPriority] = useState('100')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation(createModelVendorBindingMutationOptions())
  const updateMutation = useMutation(updateModelVendorBindingMutationOptions())
  const deleteMutation = useMutation(deleteModelVendorBindingMutationOptions())

  const attach = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await createMutation.mutateAsync({
        modelId,
        input: {
          vendorId,
          apiName: apiName.trim(),
          enabled: true,
          priority: Number(priority) || 100,
        },
      })
      setVendorId('')
      setApiName('')
      setPriority('100')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to attach vendor'))
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Vendors</h2>
        <p className="text-sm text-muted-foreground">
          Bind vendors that provide this model. Each binding has its own API
          name, enabled state, and priority (lower is preferred).
        </p>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>API name</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {boundVendors.map((binding) => (
              <VendorBindingRow
                key={binding.vendorId}
                binding={binding}
                onUpdate={(input) =>
                  updateMutation.mutate({
                    modelId,
                    vendorId: binding.vendorId,
                    input,
                  })
                }
                onDelete={() => {
                  if (!window.confirm(`Detach vendor “${binding.name}”?`))
                    return
                  deleteMutation.mutate({ modelId, vendorId: binding.vendorId })
                }}
              />
            ))}
            {boundVendors.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-muted-foreground"
                >
                  No vendors bound to this model.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <form className="space-y-3 rounded-xl border p-4" onSubmit={attach}>
        <h3 className="text-sm font-medium">Attach vendor</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select
              value={vendorId || undefined}
              onValueChange={setVendorId}
              disabled={unusedVendors.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    unusedVendors.length === 0
                      ? 'All vendors attached'
                      : 'Select vendor'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {unusedVendors.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-api-name">API name</Label>
            <Input
              id="vendor-api-name"
              value={apiName}
              onChange={(event) => setApiName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vendor-priority">Priority</Label>
            <Input
              id="vendor-priority"
              type="number"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={!vendorId || createMutation.isPending}>
          {createMutation.isPending ? 'Attaching…' : 'Attach vendor'}
        </Button>
      </form>
    </section>
  )
}

function VendorBindingRow({
  binding,
  onUpdate,
  onDelete,
}: {
  binding: {
    vendorId: string
    name: string
    apiName: string
    enabled: boolean
    priority: number
  }
  onUpdate: (input: {
    apiName?: string
    enabled?: boolean
    priority?: number
  }) => void
  onDelete: () => void
}) {
  const [apiName, setApiName] = useState(binding.apiName)
  const [priority, setPriority] = useState(String(binding.priority))

  useEffect(() => {
    setApiName(binding.apiName)
    setPriority(String(binding.priority))
  }, [binding])

  return (
    <TableRow>
      <TableCell className="align-top font-medium">{binding.name}</TableCell>
      <TableCell className="align-top">
        <Input
          value={apiName}
          onChange={(event) => setApiName(event.target.value)}
          onBlur={() => {
            if (apiName.trim() && apiName.trim() !== binding.apiName) {
              onUpdate({ apiName: apiName.trim() })
            }
          }}
        />
      </TableCell>
      <TableCell className="align-top">
        <Input
          type="number"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          onBlur={() => {
            const next = Number(priority)
            if (Number.isFinite(next) && next !== binding.priority) {
              onUpdate({ priority: next })
            }
          }}
        />
      </TableCell>
      <TableCell className="align-top">
        <Switch
          checked={binding.enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
        />
      </TableCell>
      <TableCell className="align-top text-right">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label={`Detach ${binding.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
