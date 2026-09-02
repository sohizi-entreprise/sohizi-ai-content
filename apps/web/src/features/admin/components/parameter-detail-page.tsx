import { useEffect, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Plus, Trash2 } from "lucide-react"
import {
  createAdminParameterOptionMutationOptions,
  deleteAdminParameterOptionMutationOptions,
  deleteVendorOptionMappingMutationOptions,
  deleteVendorParameterMappingMutationOptions,
  getAdminParameterQueryOptions,
  listAdminVendorsQueryOptions,
  updateAdminParameterMutationOptions,
  updateAdminParameterOptionMutationOptions,
  upsertVendorOptionMappingMutationOptions,
  upsertVendorParameterMappingMutationOptions,
} from "../query-mutation"
import { getAdminErrorMessage } from "../requests"
import type {
  AdminParameterOption,
  ModelParameterDataType,
  ModelParameterUIComponent,
  UpdateParameterInput,
} from "../types"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
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

const PARAMETER_TYPES: Array<ModelParameterDataType> = [
  "string",
  "number",
  "boolean",
  "array<string>",
  "array<number>",
]
const UI_COMPONENTS: Array<ModelParameterUIComponent> = [
  "select",
  "slider",
  "uploader",
]
const NONE_VALUE = "__none__"

type Props = {
  parameterId: string
}

export function ParameterDetailPage({ parameterId }: Props) {
  const {
    data: parameter,
    isLoading,
    error,
  } = useQuery(getAdminParameterQueryOptions(parameterId))
  const { data: vendors = [] } = useQuery(listAdminVendorsQueryOptions())

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading parameter…</p>
  }
  if (error || !parameter) {
    return <p className="text-sm text-destructive">Failed to load parameter</p>
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/admin/parameters"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Parameters
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {parameter.label}
        </h1>
        <p className="font-mono text-sm text-muted-foreground">
          {parameter.key}
        </p>
      </div>

      <ParameterMetaForm parameterId={parameterId} parameter={parameter} />
      {parameter.xUiComponent === "select" ? (
        <OptionsSection
          parameterId={parameterId}
          options={parameter.options}
          vendors={vendors}
        />
      ) : null}
      <VendorParameterMaps
        parameterId={parameterId}
        mappings={parameter.vendorMappings}
        vendors={vendors}
      />
    </div>
  )
}

function ParameterMetaForm({
  parameterId,
  parameter,
}: {
  parameterId: string
  parameter: {
    key: string
    label: string
    type: ModelParameterDataType
    description: string | null
    xUiComponent: ModelParameterUIComponent | null
  }
}) {
  const [form, setForm] = useState({
    key: parameter.key,
    label: parameter.label,
    type: parameter.type,
    description: parameter.description ?? "",
    xUiComponent: parameter.xUiComponent ?? "",
  })
  const [error, setError] = useState<string | null>(null)
  const updateMutation = useMutation(updateAdminParameterMutationOptions())

  useEffect(() => {
    setForm({
      key: parameter.key,
      label: parameter.label,
      type: parameter.type,
      description: parameter.description ?? "",
      xUiComponent: parameter.xUiComponent ?? "",
    })
  }, [parameter])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const input: UpdateParameterInput = {
      key: form.key,
      label: form.label,
      type: form.type,
      description: form.description || null,
      xUiComponent: form.xUiComponent || null,
    }
    try {
      await updateMutation.mutateAsync({ id: parameterId, input })
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to save parameter"))
    }
  }

  return (
    <form className="space-y-4 rounded-xl border p-4" onSubmit={handleSubmit}>
      <h2 className="text-sm font-medium">Details</h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="detail-key">Key</Label>
          <Input
            id="detail-key"
            value={form.key}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, key: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="detail-label">Label</Label>
          <Input
            id="detail-label"
            value={form.label}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, label: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={form.type}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                type: value as ModelParameterDataType,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARAMETER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>UI component</Label>
          <Select
            value={form.xUiComponent || NONE_VALUE}
            onValueChange={(value) =>
              setForm((prev) => ({
                ...prev,
                xUiComponent: value === NONE_VALUE ? "" : value,
              }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None</SelectItem>
              {UI_COMPONENTS.map((component) => (
                <SelectItem key={component} value={component}>
                  {component}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="detail-description">Description</Label>
        <Input
          id="detail-description"
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? "Saving…" : "Save details"}
      </Button>
    </form>
  )
}

function OptionsSection({
  parameterId,
  options,
  vendors,
}: {
  parameterId: string
  options: Array<AdminParameterOption>
  vendors: Array<{ id: string; name: string }>
}) {
  const [draft, setDraft] = useState({ label: "", value: "", description: "" })
  const [error, setError] = useState<string | null>(null)
  const createMutation = useMutation(
    createAdminParameterOptionMutationOptions(),
  )
  const updateMutation = useMutation(
    updateAdminParameterOptionMutationOptions(),
  )
  const deleteMutation = useMutation(
    deleteAdminParameterOptionMutationOptions(),
  )

  const addOption = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    try {
      await createMutation.mutateAsync({
        parameterId,
        input: {
          label: draft.label.trim(),
          value: draft.value.trim(),
          description: draft.description.trim() || null,
        },
      })
      setDraft({ label: "", value: "", description: "" })
    } catch (err) {
      setError(getAdminErrorMessage(err, "Failed to create option"))
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Options</h2>
        <p className="text-sm text-muted-foreground">
          Catalog values for this parameter. Map each option to a
          vendor-specific value.
        </p>
      </div>

      <form
        className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2"
        onSubmit={addOption}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input
            value={draft.label}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, label: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Value</Label>
          <Input
            value={draft.value}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, value: event.target.value }))
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input
            value={draft.description}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="size-4" />
          Add
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            parameterId={parameterId}
            option={option}
            vendors={vendors}
            onSave={async (input) => {
              await updateMutation.mutateAsync({
                parameterId,
                optionId: option.id,
                input,
              })
            }}
            onDelete={() => {
              if (!window.confirm(`Delete option “${option.label}”?`)) return
              deleteMutation.mutate({ parameterId, optionId: option.id })
            }}
          />
        ))}
        {options.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
            No options yet.
          </p>
        ) : null}
      </div>
    </section>
  )
}

function OptionCard({
  parameterId,
  option,
  vendors,
  onSave,
  onDelete,
}: {
  parameterId: string
  option: AdminParameterOption
  vendors: Array<{ id: string; name: string }>
  onSave: (input: {
    label: string
    value: string
    description: string | null
  }) => Promise<void>
  onDelete: () => void
}) {
  const [form, setForm] = useState({
    label: option.label,
    value: option.value,
    description: option.description ?? "",
  })
  const [vendorId, setVendorId] = useState("")
  const [vendorValue, setVendorValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const upsertMap = useMutation(upsertVendorOptionMappingMutationOptions())
  const deleteMap = useMutation(deleteVendorOptionMappingMutationOptions())

  useEffect(() => {
    setForm({
      label: option.label,
      value: option.value,
      description: option.description ?? "",
    })
  }, [option])

  const unusedVendors = vendors.filter(
    (vendor) =>
      !option.vendorMappings.some((mapping) => mapping.vendorId === vendor.id),
  )

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Label</Label>
          <Input
            value={form.label}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, label: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Value</Label>
          <Input
            value={form.value}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, value: event.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input
            value={form.description}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, description: event.target.value }))
            }
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            setError(null)
            try {
              await onSave({
                label: form.label.trim(),
                value: form.value.trim(),
                description: form.description.trim() || null,
              })
            } catch (err) {
              setError(getAdminErrorMessage(err, "Failed to save option"))
            }
          }}
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label="Delete option"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Vendor mappings
        </p>
        {option.vendorMappings.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Vendor value</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {option.vendorMappings.map((mapping) => (
                <TableRow key={mapping.vendorId}>
                  <TableCell>{mapping.vendorName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {mapping.vendorOptionValue}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        deleteMap.mutate({
                          parameterId,
                          optionId: option.id,
                          vendorId: mapping.vendorId,
                        })
                      }
                      aria-label="Remove mapping"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground">No vendor mappings.</p>
        )}
        <div className="flex gap-2">
          <Select
            value={vendorId || undefined}
            onValueChange={setVendorId}
            disabled={unusedVendors.length === 0}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue
                placeholder={
                  unusedVendors.length === 0 ? "All vendors mapped" : "Vendor"
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
          <Input
            className="flex-1"
            value={vendorValue}
            placeholder="Vendor option value"
            onChange={(event) => setVendorValue(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={!vendorId || !vendorValue.trim() || upsertMap.isPending}
            onClick={async () => {
              setError(null)
              try {
                await upsertMap.mutateAsync({
                  parameterId,
                  optionId: option.id,
                  vendorId,
                  input: { vendorOptionValue: vendorValue.trim() },
                })
                setVendorId("")
                setVendorValue("")
              } catch (err) {
                setError(
                  getAdminErrorMessage(err, "Failed to map vendor option"),
                )
              }
            }}
          >
            Map
          </Button>
        </div>
      </div>
    </div>
  )
}

function VendorParameterMaps({
  parameterId,
  mappings,
  vendors,
}: {
  parameterId: string
  mappings: Array<{
    vendorId: string
    vendorName: string
    vendorParamName: string | null
    vendorDefaultValue: string | null
  }>
  vendors: Array<{ id: string; name: string }>
}) {
  const [vendorId, setVendorId] = useState("")
  const [vendorParamName, setVendorParamName] = useState("")
  const [vendorDefaultValue, setVendorDefaultValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const upsertMap = useMutation(upsertVendorParameterMappingMutationOptions())
  const deleteMap = useMutation(deleteVendorParameterMappingMutationOptions())

  const unusedVendors = vendors.filter(
    (vendor) => !mappings.some((mapping) => mapping.vendorId === vendor.id),
  )

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Vendor parameter names</h2>
        <p className="text-sm text-muted-foreground">
          Override the parameter name and default value per vendor.
        </p>
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Param name</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={mapping.vendorId}>
                <TableCell>{mapping.vendorName}</TableCell>
                <TableCell className="font-mono text-xs">
                  {mapping.vendorParamName ?? "—"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {mapping.vendorDefaultValue ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      deleteMap.mutate({
                        parameterId,
                        vendorId: mapping.vendorId,
                      })
                    }
                    aria-label="Remove vendor parameter mapping"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-6 text-center text-muted-foreground"
                >
                  No vendor parameter mappings.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="grid grid-cols-[200px_1fr_1fr_auto] gap-2">
        <Select
          value={vendorId || undefined}
          onValueChange={setVendorId}
          disabled={unusedVendors.length === 0}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={
                unusedVendors.length === 0 ? "All vendors mapped" : "Vendor"
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
        <Input
          value={vendorParamName}
          placeholder="Vendor param name"
          onChange={(event) => setVendorParamName(event.target.value)}
        />
        <Input
          value={vendorDefaultValue}
          placeholder="Vendor default"
          onChange={(event) => setVendorDefaultValue(event.target.value)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!vendorId || upsertMap.isPending}
          onClick={async () => {
            setError(null)
            try {
              await upsertMap.mutateAsync({
                parameterId,
                vendorId,
                input: {
                  vendorParamName: vendorParamName.trim() || null,
                  vendorDefaultValue: vendorDefaultValue.trim() || null,
                },
              })
              setVendorId("")
              setVendorParamName("")
              setVendorDefaultValue("")
            } catch (err) {
              setError(
                getAdminErrorMessage(err, "Failed to map vendor parameter"),
              )
            }
          }}
        >
          Map
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
