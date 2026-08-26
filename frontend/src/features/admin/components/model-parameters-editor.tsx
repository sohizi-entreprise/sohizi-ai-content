import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import type {
  AdminParameter,
  ModelParameterBinding,
  ModelParameterConstraint,
  ParameterOptionSummary,
  ReplaceModelParameterBinding,
} from '../types'

export type ParameterBindingDraft = {
  parameterId: string
  key: string
  label: string
  type: AdminParameter['type']
  description: string | null
  xUiComponent: AdminParameter['xUiComponent']
  required: boolean
  defaultValue: string
  constraints: ModelParameterConstraint | null
  optionIds: string[]
  optionMultipliers: Record<string, string>
  catalogOptions: ParameterOptionSummary[]
}

export const bindingsToDrafts = (
  bindings: ModelParameterBinding[],
  catalog: AdminParameter[],
): ParameterBindingDraft[] =>
  bindings.map((binding) => {
    const catalogParameter = catalog.find((item) => item.id === binding.parameterId)
    return {
      parameterId: binding.parameterId,
      key: binding.key,
      label: binding.label,
      type: binding.type,
      description: binding.description,
      xUiComponent: binding.xUiComponent,
      required: binding.required,
      defaultValue: binding.defaultValue ?? '',
      constraints: binding.constraints,
      optionIds: binding.options.map((option) => option.id),
      optionMultipliers: Object.fromEntries(
        binding.options.map((option) => [
          option.id,
          option.priceMultiplier == null ? '' : String(option.priceMultiplier),
        ]),
      ),
      catalogOptions: catalogParameter?.options ?? binding.options,
    }
  })

export const draftsToPayload = (drafts: ParameterBindingDraft[]): ReplaceModelParameterBinding[] =>
  drafts.map((draft, index) => {
    const constraints = draft.constraints
    const hasConstraints = Boolean(
      constraints &&
        (constraints.min != null ||
          constraints.max != null ||
          constraints.step != null ||
          constraints.fileType),
    )
    return {
      parameterId: draft.parameterId,
      required: draft.required,
      defaultValue: draft.defaultValue.trim() || null,
      constraints: hasConstraints ? constraints : null,
      options: draft.optionIds.map((optionId) => {
        const raw = draft.optionMultipliers[optionId]?.trim() ?? ''
        let priceMultiplier: number | null = null
        if (raw !== '') {
          const parsed = Number(raw)
          if (!Number.isFinite(parsed) || parsed < 0) {
            throw new Error(`Invalid price multiplier for ${draft.label}`)
          }
          priceMultiplier = parsed
        }
        return { optionId, priceMultiplier }
      }),
      sortOrder: index,
    }
  })

const parameterToDraft = (parameter: AdminParameter): ParameterBindingDraft => ({
  parameterId: parameter.id,
  key: parameter.key,
  label: parameter.label,
  type: parameter.type,
  description: parameter.description,
  xUiComponent: parameter.xUiComponent,
  required: false,
  defaultValue: '',
  constraints: null,
  optionIds: [],
  optionMultipliers: {},
  catalogOptions: parameter.options ?? [],
})

type Props = {
  value: ParameterBindingDraft[]
  onChange: (value: ParameterBindingDraft[]) => void
  catalog: AdminParameter[]
}

export function ModelParametersEditor({ value, onChange, catalog }: Props) {
  const [selectedId, setSelectedId] = useState<string>('')
  const unbound = catalog.filter(
    (parameter) => !value.some((draft) => draft.parameterId === parameter.id),
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = value.findIndex((item) => item.parameterId === active.id)
    const newIndex = value.findIndex((item) => item.parameterId === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(value, oldIndex, newIndex))
  }

  const addParameter = () => {
    const parameter = catalog.find((item) => item.id === selectedId)
    if (!parameter) return
    onChange([...value, parameterToDraft(parameter)])
    setSelectedId('')
  }

  const updateDraft = (parameterId: string, patch: Partial<ParameterBindingDraft>) => {
    onChange(value.map((item) => (item.parameterId === parameterId ? { ...item, ...patch } : item)))
  }

  const removeDraft = (parameterId: string) => {
    onChange(value.filter((item) => item.parameterId !== parameterId))
  }

  return (
    <div className="space-y-3">
      <Label>Parameters</Label>
      <div className="flex gap-2">
        <Select value={selectedId || undefined} onValueChange={setSelectedId} disabled={unbound.length === 0}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder={unbound.length === 0 ? 'All parameters bound' : 'Add a parameter'} />
          </SelectTrigger>
          <SelectContent>
            {unbound.map((parameter) => (
              <SelectItem key={parameter.id} value={parameter.id}>
                {parameter.label} ({parameter.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" onClick={addParameter} disabled={!selectedId}>
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No parameters bound yet.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={value.map((item) => item.parameterId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {value.map((draft) => (
                <SortableBindingCard
                  key={draft.parameterId}
                  draft={draft}
                  onChange={(patch) => updateDraft(draft.parameterId, patch)}
                  onRemove={() => removeDraft(draft.parameterId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

function SortableBindingCard({
  draft,
  onChange,
  onRemove,
}: {
  draft: ParameterBindingDraft
  onChange: (patch: Partial<ParameterBindingDraft>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: draft.parameterId,
  })

  const showOptions = draft.xUiComponent === 'select' || draft.catalogOptions.length > 0
  const showNumericConstraints = draft.type === 'number' || draft.xUiComponent === 'slider'
  const showFileType = draft.xUiComponent === 'uploader'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-lg border bg-background p-3', isDragging && 'opacity-60')}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          aria-label="Reorder parameter"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{draft.label}</p>
              <p className="font-mono text-xs text-muted-foreground">{draft.key}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove parameter">
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Default value</Label>
            <Input
              value={draft.defaultValue}
              onChange={(event) => onChange({ defaultValue: event.target.value })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label className="text-xs">Required</Label>
            <Switch
              checked={draft.required}
              onCheckedChange={(checked) => onChange({ required: checked })}
            />
          </div>
          {showOptions ? (
            <VisibleOptionsEditor
              options={draft.catalogOptions}
              selectedIds={draft.optionIds}
              multipliers={draft.optionMultipliers}
              onChange={(optionIds, optionMultipliers) => onChange({ optionIds, optionMultipliers })}
            />
          ) : null}
          {showNumericConstraints ? (
            <ConstraintsEditor
              value={draft.constraints}
              onChange={(constraints) => onChange({ constraints })}
            />
          ) : null}
          {showFileType ? (
            <div className="space-y-1.5">
              <Label className="text-xs">File type</Label>
              <Select
                value={draft.constraints?.fileType ?? '__none__'}
                onValueChange={(selected) =>
                  onChange({
                    constraints: {
                      ...draft.constraints,
                      fileType:
                        selected === '__none__'
                          ? undefined
                          : (selected as NonNullable<ModelParameterConstraint['fileType']>),
                    },
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  <SelectItem value="image">image</SelectItem>
                  <SelectItem value="video">video</SelectItem>
                  <SelectItem value="audio">audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function VisibleOptionsEditor({
  options,
  selectedIds,
  multipliers,
  onChange,
}: {
  options: ParameterOptionSummary[]
  selectedIds: string[]
  multipliers: Record<string, string>
  onChange: (optionIds: string[], optionMultipliers: Record<string, string>) => void
}) {
  if (options.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        This parameter has no catalog options yet.
      </p>
    )
  }

  const selected = new Set(selectedIds)

  const toggle = (optionId: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedIds, optionId], {
        ...multipliers,
        [optionId]: multipliers[optionId] ?? '',
      })
      return
    }
    const nextMultipliers = { ...multipliers }
    delete nextMultipliers[optionId]
    onChange(selectedIds.filter((id) => id !== optionId), nextMultipliers)
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Visible options</Label>
      <div className="space-y-2 rounded-lg border p-3">
        {options.map((option) => {
          const isSelected = selected.has(option.id)
          return (
            <div key={option.id} className="flex items-center gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => toggle(option.id, checked === true)}
                />
                <span className="min-w-0 truncate">
                  {option.label}
                  <span className="ml-1 font-mono text-xs text-muted-foreground">{option.value}</span>
                </span>
              </label>
              {isSelected ? (
                <Input
                  className="h-8 w-20"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="1×"
                  value={multipliers[option.id] ?? ''}
                  onChange={(event) =>
                    onChange(selectedIds, {
                      ...multipliers,
                      [option.id]: event.target.value,
                    })
                  }
                  aria-label={`Price multiplier for ${option.label}`}
                />
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConstraintsEditor({
  value,
  onChange,
}: {
  value: ModelParameterConstraint | null
  onChange: (value: ModelParameterConstraint | null) => void
}) {
  const update = (patch: Partial<ModelParameterConstraint>) => {
    const next = { ...value, ...patch }
    const empty =
      next.min == null && next.max == null && next.step == null && next.fileType == null
    onChange(empty ? null : next)
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Min</Label>
        <Input
          type="number"
          value={value?.min ?? ''}
          onChange={(event) =>
            update({ min: event.target.value === '' ? undefined : Number(event.target.value) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Max</Label>
        <Input
          type="number"
          value={value?.max ?? ''}
          onChange={(event) =>
            update({ max: event.target.value === '' ? undefined : Number(event.target.value) })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Step</Label>
        <Input
          type="number"
          value={value?.step ?? ''}
          onChange={(event) =>
            update({ step: event.target.value === '' ? undefined : Number(event.target.value) })
          }
        />
      </div>
    </div>
  )
}
