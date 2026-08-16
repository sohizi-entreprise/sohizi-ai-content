import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  type ParameterBindingDraft,
} from './model-parameters-editor'
import {
  emptyPricingFormState,
  formStateToPricing,
  PricingEditor,
  pricingToFormState,
  type PricingFormState,
} from './pricing-editor'

type Props = {
  modelId: string
}

const EMPTY_LIST: never[] = []

export function ModelDetailPage({ modelId }: Props) {
  const { data: model, isLoading, error } = useQuery(getAdminModelQueryOptions(modelId))
  const { data: categories = EMPTY_LIST } = useQuery(listAdminCategoriesQueryOptions())
  const { data: catalog = EMPTY_LIST } = useQuery(listAdminParametersQueryOptions())
  const { data: existingBindings } = useQuery(listModelParametersQueryOptions(modelId))
  const { data: vendors = EMPTY_LIST } = useQuery(listAdminVendorsQueryOptions())

  const [form, setForm] = useState({
    provider: '',
    name: '',
    enabled: true,
    categoryNames: [] as string[],
  })
  const [bindings, setBindings] = useState<ParameterBindingDraft[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const hydratedBindingsFor = useRef<string | null>(null)

  const updateMutation = useMutation(updateAdminModelMutationOptions())
  const replaceParametersMutation = useMutation(replaceModelParametersMutationOptions())

  useEffect(() => {
    if (!model) return
    setForm({
      provider: model.provider,
      name: model.name,
      enabled: model.enabled,
      categoryNames: model.categories,
    })
  }, [model])

  useEffect(() => {
    if (!model || !existingBindings) return
    if (hydratedBindingsFor.current === model.id) {
      setBindings((prev) => {
        let changed = false
        const next = prev.map((draft) => {
          const catalogParameter = catalog.find((item) => item.id === draft.parameterId)
          if (!catalogParameter || draft.catalogOptions === catalogParameter.options) {
            return draft
          }
          changed = true
          return { ...draft, catalogOptions: catalogParameter.options }
        })
        return changed ? next : prev
      })
      return
    }
    hydratedBindingsFor.current = model.id
    setBindings(bindingsToDrafts(existingBindings, catalog))
  }, [model, existingBindings, catalog])

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
      await updateMutation.mutateAsync({
        id: modelId,
        input: {
          provider: form.provider,
          name: form.name,
          enabled: form.enabled,
          categoryNames: form.categoryNames,
        },
      })
      await replaceParametersMutation.mutateAsync({
        modelId,
        input: draftsToPayload(bindings),
      })
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to save model')
      setSaveError(message)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading model…</p>
  }
  if (error || !model) {
    return <p className="text-sm text-destructive">Failed to load model</p>
  }

  const pending = updateMutation.isPending || replaceParametersMutation.isPending

  return (
    <div className="space-y-8">
      <div>
        <Link to="/admin/models" className="text-sm text-muted-foreground hover:text-foreground">
          ← Models
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{model.name}</h1>
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
              onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-name">Display name</Label>
            <Input
              id="model-name"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="model-enabled">Enabled</Label>
            <Switch
              id="model-enabled"
              checked={form.enabled}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Categories</Label>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-lg border p-3">
              {categories.map((category) => (
                <label key={category.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.categoryNames.includes(category.name)}
                    onCheckedChange={(checked) => toggleCategory(category.name, checked === true)}
                  />
                  <span>{category.name}</span>
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border p-4">
          <ModelParametersEditor value={bindings} onChange={setBindings} catalog={catalog} />
        </section>

        {saveError ? <p className="text-sm text-destructive">{saveError}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save model'}
        </Button>
      </form>

      <ModelVendorsSection
        modelId={modelId}
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
    pricing: Parameters<typeof pricingToFormState>[0]
    enabled: boolean
  }>
  vendors: Array<{ id: string; name: string }>
}) {
  const unusedVendors = vendors.filter(
    (vendor) => !boundVendors.some((binding) => binding.vendorId === vendor.id),
  )
  const [vendorId, setVendorId] = useState('')
  const [apiName, setApiName] = useState('')
  const [pricing, setPricing] = useState<PricingFormState>(emptyPricingFormState())
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
          pricing: formStateToPricing(pricing),
          enabled: true,
        },
      })
      setVendorId('')
      setApiName('')
      setPricing(emptyPricingFormState())
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (err instanceof Error ? err.message : 'Failed to attach vendor')
      setError(message)
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Vendors</h2>
        <p className="text-sm text-muted-foreground">
          Bind vendors that provide this model. Each binding has its own API name, pricing, and enabled state.
        </p>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>API name</TableHead>
              <TableHead>Pricing</TableHead>
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
                  updateMutation.mutate({ modelId, vendorId: binding.vendorId, input })
                }
                onDelete={() => {
                  if (!window.confirm(`Detach vendor “${binding.name}”?`)) return
                  deleteMutation.mutate({ modelId, vendorId: binding.vendorId })
                }}
              />
            ))}
            {boundVendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No vendors bound to this model.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <form className="space-y-3 rounded-xl border p-4" onSubmit={attach}>
        <h3 className="text-sm font-medium">Attach vendor</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select
              value={vendorId || undefined}
              onValueChange={setVendorId}
              disabled={unusedVendors.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={unusedVendors.length === 0 ? 'All vendors attached' : 'Select vendor'} />
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
        </div>
        <PricingEditor value={pricing} onChange={setPricing} />
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
    pricing: Parameters<typeof pricingToFormState>[0]
    enabled: boolean
  }
  onUpdate: (input: { apiName?: string; pricing?: ReturnType<typeof formStateToPricing>; enabled?: boolean }) => void
  onDelete: () => void
}) {
  const [apiName, setApiName] = useState(binding.apiName)
  const [pricing, setPricing] = useState<PricingFormState>(pricingToFormState(binding.pricing))
  const [openPricing, setOpenPricing] = useState(false)

  useEffect(() => {
    setApiName(binding.apiName)
    setPricing(pricingToFormState(binding.pricing))
  }, [binding])

  return (
    <TableRow>
      <TableCell className="align-top font-medium">{binding.name}</TableCell>
      <TableCell className="align-top">
        <div className="space-y-2">
          <Input
            value={apiName}
            onChange={(event) => setApiName(event.target.value)}
            onBlur={() => {
              if (apiName.trim() && apiName.trim() !== binding.apiName) {
                onUpdate({ apiName: apiName.trim() })
              }
            }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpenPricing((open) => !open)}>
            {openPricing ? 'Hide pricing' : binding.pricing ? 'Edit pricing' : 'Add pricing'}
          </Button>
          {openPricing ? (
            <div className="space-y-2">
              <PricingEditor value={pricing} onChange={setPricing} />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onUpdate({ pricing: formStateToPricing(pricing) })}
              >
                Save pricing
              </Button>
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">
        {binding.pricing ? 'Configured' : '—'}
      </TableCell>
      <TableCell className="align-top">
        <Switch
          checked={binding.enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
        />
      </TableCell>
      <TableCell className="align-top text-right">
        <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label={`Detach ${binding.name}`}>
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
}
