import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ModelOptionChoice } from '../types'

type ChoiceRow = {
  id: string
  value: string
  label: string
}

export type OptionChoicesFormState = {
  rows: ChoiceRow[]
  defaultValue: string
}

const createRow = (value = '', label = ''): ChoiceRow => ({
  id: crypto.randomUUID(),
  value,
  label,
})

export const emptyOptionChoicesFormState = (): OptionChoicesFormState => ({
  rows: [createRow(), createRow()],
  defaultValue: '',
})

export const choicesToFormState = (
  choices: ModelOptionChoice[],
  defaultValue?: string | null,
): OptionChoicesFormState => {
  const rows =
    choices.length > 0
      ? choices.map((choice) => createRow(choice.value, choice.label))
      : [createRow(), createRow()]

  const defaults = defaultValue && choices.some((choice) => choice.value === defaultValue)
    ? defaultValue
    : ''

  return {
    rows,
    defaultValue: defaults,
  }
}

export const formStateToChoices = (
  state: OptionChoicesFormState,
): { options: ModelOptionChoice[]; default: string | null } => {
  const options: ModelOptionChoice[] = []

  for (const [index, row] of state.rows.entries()) {
    const value = row.value.trim()
    const label = row.label.trim()

    if (!value || !label) {
      throw new Error(`Choice ${index + 1}: both value and label are required`)
    }

    if (options.some((option) => option.value === value)) {
      throw new Error(`Choice ${index + 1}: duplicate value "${value}"`)
    }

    options.push({ value, label })
  }

  if (options.length === 0) {
    throw new Error('Add at least one choice')
  }

  const defaultValue = state.defaultValue.trim()
  if (defaultValue && !options.some((option) => option.value === defaultValue)) {
    throw new Error('Default value must match one of the choice values')
  }

  return {
    options,
    default: defaultValue || null,
  }
}

type Props = {
  value: OptionChoicesFormState
  onChange: (value: OptionChoicesFormState) => void
}

export function OptionChoicesEditor({ value, onChange }: Props) {
  const updateRow = (id: string, patch: Partial<ChoiceRow>) => {
    const rows = value.rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
    const nextDefault =
      value.defaultValue && rows.some((row) => row.value.trim() === value.defaultValue)
        ? value.defaultValue
        : ''
    onChange({ rows, defaultValue: nextDefault })
  }

  const removeRow = (id: string) => {
    const rows = value.rows.filter((row) => row.id !== id)
    const nextDefault =
      value.defaultValue && rows.some((row) => row.value.trim() === value.defaultValue)
        ? value.defaultValue
        : ''
    onChange({ rows, defaultValue: nextDefault })
  }

  const addRow = () => {
    onChange({
      ...value,
      rows: [...value.rows, createRow()],
    })
  }

  const choiceValues = value.rows
    .map((row) => row.value.trim())
    .filter(Boolean)

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-lg border p-3">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
          <span>Value</span>
          <span>Label</span>
          <span />
        </div>

        {value.rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
            <Input
              placeholder="16:9"
              value={row.value}
              onChange={(event) => updateRow(row.id, { value: event.target.value })}
              required
            />
            <Input
              placeholder="16:9"
              value={row.label}
              onChange={(event) => updateRow(row.id, { label: event.target.value })}
              required
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => removeRow(row.id)}
              disabled={value.rows.length <= 1}
              aria-label="Remove choice"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Add choice
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Default value</Label>
        <Select
          value={value.defaultValue || '__none__'}
          onValueChange={(selected) =>
            onChange({
              ...value,
              defaultValue: selected === '__none__' ? '' : selected,
            })
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="No default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No default</SelectItem>
            {choiceValues.map((choiceValue) => (
              <SelectItem key={choiceValue} value={choiceValue}>
                {choiceValue}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
