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
import type { TokenPricing } from '../types'

export type PricingUnit = 'none' | 'per_1m_tokens'

type TokenKind = 'input' | 'output' | 'cached_input'

type PricingRow = {
  id: string
  kind: TokenKind
  upTo: string
  rate: string
}

export type PricingFormState = {
  unit: PricingUnit
  rows: PricingRow[]
}

const TOKEN_KIND_OPTIONS: Array<{ value: TokenKind; label: string }> = [
  { value: 'input', label: 'Input' },
  { value: 'output', label: 'Output' },
  { value: 'cached_input', label: 'Cache' },
]

const createRow = (kind: TokenKind = 'input'): PricingRow => ({
  id: crypto.randomUUID(),
  kind,
  upTo: '',
  rate: '',
})

export const emptyPricingFormState = (): PricingFormState => ({
  unit: 'none',
  rows: [],
})

export const pricingToFormState = (pricing: TokenPricing | null | undefined): PricingFormState => {
  if (!pricing || pricing.unit !== 'per_1m_tokens') {
    return emptyPricingFormState()
  }

  const rows: PricingRow[] = []
  for (const tier of pricing.input ?? []) {
    rows.push({
      id: crypto.randomUUID(),
      kind: 'input',
      upTo: tier.up_to == null ? '' : String(tier.up_to),
      rate: String(tier.rate),
    })
  }
  for (const tier of pricing.output ?? []) {
    rows.push({
      id: crypto.randomUUID(),
      kind: 'output',
      upTo: tier.up_to == null ? '' : String(tier.up_to),
      rate: String(tier.rate),
    })
  }
  for (const tier of pricing.cached_input ?? []) {
    rows.push({
      id: crypto.randomUUID(),
      kind: 'cached_input',
      upTo: tier.up_to == null ? '' : String(tier.up_to),
      rate: String(tier.rate),
    })
  }

  return {
    unit: 'per_1m_tokens',
    rows: rows.length > 0 ? rows : [createRow('input'), createRow('output')],
  }
}

export const formStateToPricing = (state: PricingFormState): TokenPricing | null => {
  if (state.unit === 'none') {
    return null
  }

  if (state.unit === 'per_1m_tokens') {
    if (state.rows.length === 0) {
      throw new Error('Add at least one pricing row for per 1M tokens')
    }

    const input: TokenPricing['input'] = []
    const output: TokenPricing['output'] = []
    const cached_input: NonNullable<TokenPricing['cached_input']> = []

    for (const [index, row] of state.rows.entries()) {
      const rate = Number(row.rate)
      if (!Number.isFinite(rate) || rate < 0) {
        throw new Error(`Row ${index + 1}: enter a valid rate per 1M tokens`)
      }

      let up_to: number | null = null
      if (row.upTo.trim() !== '') {
        const parsed = Number(row.upTo)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          throw new Error(`Row ${index + 1}: "up to" must be a positive number or empty`)
        }
        up_to = parsed
      }

      const tier = { up_to, rate }
      if (row.kind === 'input') input.push(tier)
      else if (row.kind === 'output') output.push(tier)
      else cached_input.push(tier)
    }

    if (input.length === 0 || output.length === 0) {
      throw new Error('Per 1M tokens pricing requires at least one input and one output rate')
    }

    return {
      currency: 'USD',
      unit: 'per_1m_tokens',
      basis: 'request_tokens',
      input,
      output,
      ...(cached_input.length > 0 ? { cached_input } : {}),
    }
  }

  return null
}

type Props = {
  value: PricingFormState
  onChange: (value: PricingFormState) => void
}

export function PricingEditor({ value, onChange }: Props) {
  const updateRow = (id: string, patch: Partial<PricingRow>) => {
    onChange({
      ...value,
      rows: value.rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    })
  }

  const removeRow = (id: string) => {
    onChange({
      ...value,
      rows: value.rows.filter((row) => row.id !== id),
    })
  }

  const addRow = () => {
    onChange({
      ...value,
      rows: [...value.rows, createRow()],
    })
  }

  const setUnit = (unit: PricingUnit) => {
    if (unit === 'none') {
      onChange({ unit, rows: [] })
      return
    }
    onChange({
      unit,
      rows: value.rows.length > 0 ? value.rows : [createRow('input'), createRow('output')],
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Pricing unit</Label>
        <Select value={value.unit} onValueChange={(unit) => setUnit(unit as PricingUnit)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select pricing unit" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No pricing</SelectItem>
            <SelectItem value="per_1m_tokens">Per 1M tokens</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.unit === 'per_1m_tokens' ? (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
            <span>Token type</span>
            <span>Up to (optional)</span>
            <span>Price / 1M</span>
            <span />
          </div>

          {value.rows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1.2fr_1fr_1fr_auto] items-center gap-2">
              <Select
                value={row.kind}
                onValueChange={(kind) => updateRow(row.id, { kind: kind as TokenKind })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TOKEN_KIND_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min={0}
                step="any"
                placeholder="∞"
                value={row.upTo}
                onChange={(event) => updateRow(row.id, { upTo: event.target.value })}
              />

              <Input
                type="number"
                min={0}
                step="any"
                placeholder="1.25"
                value={row.rate}
                onChange={(event) => updateRow(row.id, { rate: event.target.value })}
                required
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => removeRow(row.id)}
                disabled={value.rows.length <= 1}
                aria-label="Remove pricing row"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-4" />
            Add rate
          </Button>
        </div>
      ) : null}
    </div>
  )
}
