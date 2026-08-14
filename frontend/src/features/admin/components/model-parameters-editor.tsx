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
import type {
  AdminParameter,
  ModelParameterBinding,
  ModelParameterConstraint,
  ReplaceModelParameterBinding,
} from '../types'

export type ParameterBindingDraft = {
  parameterId: string
  key: string
  label: string
  type: AdminParameter['type']
  description: string | null
  xUiComponent: AdminParameter['xUiComponent']
  providerParamName: string
  required: boolean
  defaultValue: string
  constraints: ModelParameterConstraint | null
  enumValues: string[]
}

export const bindingsToDrafts = (bindings: ModelParameterBinding[]): ParameterBindingDraft[] =>
  bindings.map((binding) => ({
    parameterId: binding.parameterId,
    key: binding.key,
    label: binding.label,
    type: binding.type,
    description: binding.description,
    xUiComponent: binding.xUiComponent,
    providerParamName: binding.providerParamName ?? '',
    required: binding.required,
    defaultValue: binding.defaultValue ?? '',
    constraints: binding.constraints,
    enumValues: binding.enum ?? [],
  }))

export const draftsToPayload = (drafts: ParameterBindingDraft[]): ReplaceModelParameterBinding[] =>
  drafts.map((draft, index) => {
    const enumValues = draft.enumValues.map((item) => item.trim()).filter(Boolean)
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
      providerParamName: draft.providerParamName.trim() || null,
      required: draft.required,
      defaultValue: draft.defaultValue.trim() || null,
      constraints: hasConstraints ? constraints : null,
      enum: enumValues.length > 0 ? enumValues : null,
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
  providerParamName: '',
  required: false,
  defaultValue: '',
  constraints: null,
  enumValues: [],
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

  const showEnum = draft.xUiComponent === 'select'
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider param name</Label>
              <Input
                value={draft.providerParamName}
                placeholder={draft.key}
                onChange={(event) => onChange({ providerParamName: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default value</Label>
              <Input
                value={draft.defaultValue}
                onChange={(event) => onChange({ defaultValue: event.target.value })}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label className="text-xs">Required</Label>
            <Switch
              checked={draft.required}
              onCheckedChange={(checked) => onChange({ required: checked })}
            />
          </div>
          {showEnum ? (
            <EnumEditor
              values={draft.enumValues}
              onChange={(enumValues) => onChange({ enumValues })}
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

function EnumEditor({
  values,
  onChange,
}: {
  values: string[]
  onChange: (values: string[]) => void
}) {
  const rows = values.length > 0 ? values : ['']

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Enum values</Label>
      <div className="space-y-2">
        {rows.map((value, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={value}
              placeholder="16:9"
              onChange={(event) => {
                const next = [...rows]
                next[index] = event.target.value
                onChange(next)
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
              aria-label="Remove enum value"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, ''])}>
          <Plus className="size-4" />
          Add value
        </Button>
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
