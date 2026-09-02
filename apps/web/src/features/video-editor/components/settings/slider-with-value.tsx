import { Slider } from "@sohizi/ui/slider"
import { Input } from "@sohizi/ui/input"
import { cn } from "@/lib/utils"

interface SliderWithValueProps {
  min: number
  max: number
  step?: number
  value: number
  onChange: (value: number) => void
  suffix?: string
}

export function SliderWithValue({
  min,
  max,
  step = 1,
  value,
  onChange,
  suffix,
}: SliderWithValueProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "min-w-0 flex-1",
          "**:data-[slot=slider-track]:h-1 **:data-[slot=slider-track]:rounded-full **:data-[slot=slider-track]:bg-muted",
          "**:data-[slot=slider-range]:bg-foreground",
          "**:data-[slot=slider-thumb]:size-3.5 **:data-[slot=slider-thumb]:border-0! **:data-[slot=slider-thumb]:bg-foreground! **:data-[slot=slider-thumb]:shadow-sm!",
          "**:data-[slot=slider-thumb]:ring-1 **:data-[slot=slider-thumb]:ring-black/5",
          "**:data-[slot=slider-thumb]:hover:ring-1! **:data-[slot=slider-thumb]:focus-visible:ring-2 **:data-[slot=slider-thumb]:focus-visible:ring-foreground/20",
        )}
      >
        <Slider
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(vs) => onChange(vs[0] ?? 0)}
        />
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isFinite(v)) return
            onChange(Math.max(min, Math.min(max, v)))
          }}
          className="h-7 w-14 rounded-lg border-0 bg-muted px-1.5 text-center text-sm tabular-nums shadow-none focus-visible:ring-1"
        />
        {suffix ? (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        ) : null}
      </div>
    </div>
  )
}
