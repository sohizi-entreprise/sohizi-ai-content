import { useMutation } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sohizi/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@sohizi/ui/tooltip"
import { saveSkillMutationOptions } from "../../query-mutations"
import type { Skill } from "../../types"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<
  Skill["status"],
  { label: string; badge: string; dot: string }
> = {
  draft: {
    label: "Draft",
    badge:
      "border-amber-500/30 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  published: {
    label: "Active",
    badge:
      "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
}

const VISIBILITY_STYLES: Record<
  Skill["visibility"],
  { label: string; badge: string; dot: string }
> = {
  private: {
    label: "Private",
    badge:
      "border-slate-500/30 bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 dark:text-slate-300",
    dot: "bg-slate-500",
  },
  public: {
    label: "Public",
    badge:
      "border-sky-500/30 bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300",
    dot: "bg-sky-500",
  },
}

const STATUS_OPTIONS = [
  {
    value: "draft" as const,
    label: "Draft",
    description: "Not available to the AI agent",
    dot: STATUS_STYLES.draft.dot,
  },
  {
    value: "published" as const,
    label: "Active",
    description: "Available to the AI agent in this project",
    dot: STATUS_STYLES.published.dot,
  },
]

const VISIBILITY_OPTIONS = [
  {
    value: "private" as const,
    label: "Private",
    description: "Only available inside this project",
    dot: VISIBILITY_STYLES.private.dot,
  },
  {
    value: "public" as const,
    label: "Public",
    description:
      "Anyone can find and reuse this skill in the skill market (requires Active)",
    dot: VISIBILITY_STYLES.public.dot,
  },
]

export function SkillMetaBadges({
  projectId,
  fileId,
  status,
  visibility,
}: {
  projectId: string
  fileId: string
  status: Skill["status"]
  visibility: Skill["visibility"]
}) {
  const { mutate, isPending } = useMutation(
    saveSkillMutationOptions(projectId, fileId),
  )

  return (
    <div className="mb-5 flex items-center gap-2">
      <SkillMetaBadge
        label={STATUS_STYLES[status].label}
        badgeClassName={STATUS_STYLES[status].badge}
        dotClassName={STATUS_STYLES[status].dot}
        tooltip="Controls whether this skill is available to the AI agent"
        value={status}
        options={STATUS_OPTIONS}
        disabled={isPending}
        onChange={(next) => mutate({ status: next })}
      />
      <SkillMetaBadge
        label={VISIBILITY_STYLES[visibility].label}
        badgeClassName={VISIBILITY_STYLES[visibility].badge}
        dotClassName={VISIBILITY_STYLES[visibility].dot}
        tooltip="Controls whether this skill can be found in the skill market"
        value={visibility}
        options={VISIBILITY_OPTIONS}
        disabled={isPending}
        onChange={(next) => {
          if (next === "public" && status !== "published") {
            toast.warning("Public skills must be Active first.")
            return
          }
          mutate({ visibility: next })
        }}
      />
    </div>
  )
}

function SkillMetaBadge<T extends string>({
  label,
  badgeClassName,
  dotClassName,
  tooltip,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  badgeClassName: string
  dotClassName: string
  tooltip: string
  value: T
  options: Array<{
    value: T
    label: string
    description: string
    dot: string
  }>
  disabled?: boolean
  onChange: (value: T) => void
}) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                "disabled:pointer-events-none disabled:opacity-50",
                badgeClassName,
              )}
            >
              <span
                className={cn("size-1.5 shrink-0 rounded-full", dotClassName)}
                aria-hidden
              />
              {label}
              <ChevronDown className="size-3 opacity-70" aria-hidden />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-64">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <DropdownMenuItem
              key={option.value}
              className={cn("items-start py-2", selected && "bg-background/50")}
              onSelect={() => {
                if (!selected) onChange(option.value)
              }}
            >
              <span className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", option.dot)}
                    aria-hidden
                  />
                  <span className={cn(selected && "font-medium")}>
                    {option.label}
                  </span>
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
