import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ModelBasePricing } from '../types'

export type PricingUnit = 'none' | 'per_1m_tokens' | 'per_inference'

export type PricingFormState = {
  unit: PricingUnit
  input: string
  output: string
  cachedInput: string
  inferenceRate: string
}

export const isModelPriced = (pricing: ModelBasePricing | null | undefined): pricing is ModelBasePricing => {
  if (!pricing) return false
  if (pricing.unit === 'per_1m_tokens') {
    return Number.isFinite(pricing.input) && Number.isFinite(pricing.output)
  }
  return pricing.unit === 'per_inference' && Number.isFinite(pricing.rate)
}

export const formatModelPricingLabel = (pricing: ModelBasePricing | null | undefined): string => {
  if (!isModelPriced(pricing)) {
    return 'No pricing'
  }
  if (pricing.unit === 'per_1m_tokens') {
    const cache =
      pricing.cached_input == null ? '' : ` · cache ${pricing.cached_input}`
    return `${pricing.input} / ${pricing.output} per 1M${cache}`
  }
  return `${pricing.rate} per inference`
}

export const emptyPricingFormState = (): PricingFormState => ({
  unit: 'none',
  input: '',
  output: '',
  cachedInput: '',
  inferenceRate: '',
})

export const pricingToFormState = (pricing: ModelBasePricing | null | undefined): PricingFormState => {
  if (!isModelPriced(pricing)) {
    return emptyPricingFormState()
  }

  if (pricing.unit === 'per_1m_tokens') {
    return {
      unit: 'per_1m_tokens',
      input: String(pricing.input),
      output: String(pricing.output),
      cachedInput: pricing.cached_input == null ? '' : String(pricing.cached_input),
      inferenceRate: '',
    }
  }

  return {
    unit: 'per_inference',
    input: '',
    output: '',
    cachedInput: '',
    inferenceRate: String(pricing.rate),
  }
}

export const formStateToPricing = (state: PricingFormState): ModelBasePricing | null => {
  if (state.unit === 'none') {
    return null
  }

  if (state.unit === 'per_1m_tokens') {
    const input = Number(state.input)
    const output = Number(state.output)
    if (!Number.isFinite(input) || input < 0) {
      throw new Error('Enter a valid input rate per 1M tokens')
    }
    if (!Number.isFinite(output) || output < 0) {
      throw new Error('Enter a valid output rate per 1M tokens')
    }

    let cached_input: number | undefined
    if (state.cachedInput.trim() !== '') {
      const cached = Number(state.cachedInput)
      if (!Number.isFinite(cached) || cached < 0) {
        throw new Error('Enter a valid cache rate per 1M tokens')
      }
      cached_input = cached
    }

    return {
      unit: 'per_1m_tokens',
      input,
      output,
      ...(cached_input != null ? { cached_input } : {}),
    }
  }

  const rate = Number(state.inferenceRate)
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error('Enter a valid per-inference rate')
  }

  return { unit: 'per_inference', rate }
}

type Props = {
  value: PricingFormState
  onChange: (value: PricingFormState) => void
}

export function PricingEditor({ value, onChange }: Props) {
  const setUnit = (unit: PricingUnit) => {
    if (unit === 'none') {
      onChange(emptyPricingFormState())
      return
    }
    onChange({ ...value, unit })
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
            <SelectItem value="per_inference">Per inference</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.unit === 'per_1m_tokens' ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Input / 1M</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="1.25"
              value={value.input}
              onChange={(event) => onChange({ ...value, input: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Output / 1M</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="10"
              value={value.output}
              onChange={(event) => onChange({ ...value, output: event.target.value })}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cache / 1M (optional)</Label>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="0.125"
              value={value.cachedInput}
              onChange={(event) => onChange({ ...value, cachedInput: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      {value.unit === 'per_inference' ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Rate per inference</Label>
          <Input
            type="number"
            min={0}
            step="any"
            placeholder="0.04"
            value={value.inferenceRate}
            onChange={(event) => onChange({ ...value, inferenceRate: event.target.value })}
            required
          />
        </div>
      ) : null}
    </div>
  )
}
