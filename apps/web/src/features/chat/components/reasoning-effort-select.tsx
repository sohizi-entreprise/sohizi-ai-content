import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sohizi/ui/dropdown-menu"
import { reasoningEffortLabel } from "../lib/reasoning-effort"
import type { ModelReasoningEffort } from "../types"
import { cn } from "@/lib/utils"

type ReasoningEffortSelectProps = {
  reasoningEffort: ModelReasoningEffort
  value: string | undefined
  onChange: (value: string) => void
  className?: string
  triggerClassName?: string
}

export function ReasoningEffortSelect({
  reasoningEffort,
  value,
  onChange,
  className,
  triggerClassName,
}: ReasoningEffortSelectProps) {
  const label = reasoningEffortLabel(reasoningEffort, value) ?? "Reasoning"

  return (
    <div
      className={cn("shrink-0", className)}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              triggerClassName,
            )}
            aria-label="Reasoning effort"
          >
            <span className="max-w-20 truncate">{label}</span>
            <ChevronDown className="size-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-[60] min-w-36"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {reasoningEffort.options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => onChange(option.value)}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
