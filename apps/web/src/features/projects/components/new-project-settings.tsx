import {
  IconAdjustmentsHorizontalFilled,
  IconAspectRatio,
  IconBook,
  IconBrandYoutube,
  IconCheck,
  IconListTree,
  IconMoodSmile,
  IconMovie,
  IconPuzzle,
  IconUserSquare,
  IconUsers,
} from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { getProjectOptionsQueryOptions } from "../query-mutation"
import {
  isAdditionalSettingKey,
  useNewProjectStore,
} from "../store/new-project-store"
import type { IconProps } from "@tabler/icons-react"
import type { ForwardRefExoticComponent, RefAttributes } from "react"
import type { SettingOption } from "../store/new-project-store"
import { cn } from "@/lib/utils"

type SettingIcon = ForwardRefExoticComponent<
  IconProps & RefAttributes<SVGSVGElement>
>

const SETTING_ICONS: Partial<Record<string, SettingIcon>> = {
  format: IconMovie,
  genre: IconPuzzle,
  tone: IconMoodSmile,
  targetAudience: IconUsers,
  primaryPlatform: IconBrandYoutube,
  outlineStructure: IconListTree,
  narrativeStyle: IconBook,
  videoAspectRatio: IconAspectRatio,
  characterStyle: IconUserSquare,
}

export default function NewProjectSettings() {
  const { data } = useQuery(getProjectOptionsQueryOptions("project"))
  const presets = data?.presets ?? []
  const { setAdditionalSetting, clearAdditionalSetting, additionalSettings } =
    useNewProjectStore()

  const selectedCount = presets.reduce((count, preset) => {
    if (isAdditionalSettingKey(preset.key) && additionalSettings[preset.key]) {
      return count + 1
    }
    return count
  }, 0)

  const handleToggle = (key: string, option: SettingOption) => {
    if (!isAdditionalSettingKey(key)) return
    const current = additionalSettings[key]
    if (current?.value === option.value) {
      clearAdditionalSetting(key)
    } else {
      setAdditionalSetting(key, option)
    }
  }

  const handleClearAll = () => {
    for (const preset of presets) {
      if (
        isAdditionalSettingKey(preset.key) &&
        additionalSettings[preset.key]
      ) {
        clearAdditionalSetting(preset.key)
      }
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="h-auto gap-1.5 rounded-full bg-card px-3.5 py-1.5 font-geist text-sm font-normal text-foreground hover:bg-card/70 cursor-pointer"
        >
          <IconAdjustmentsHorizontalFilled className="size-4" />
          <span>Settings</span>
          {selectedCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              ({selectedCount})
            </span>
          ) : null}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl bg-surface p-6 rounded-2xl font-geist">
        <DialogHeader className="flex flex-row items-baseline justify-between gap-4 space-y-0">
          <div className="space-y-1 text-left">
            <DialogTitle className="text-base font-semibold text-white">
              Project Settings
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pick any settings to shape your brief. All fields are optional.
            </DialogDescription>
          </div>

          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={handleClearAll}
              className="shrink-0 cursor-pointer text-xs text-muted-foreground transition-colors hover:text-white"
            >
              Clear all
            </button>
          ) : null}
        </DialogHeader>

        <div className="mt-2 max-h-[62vh] space-y-5 overflow-y-auto overscroll-y-none pr-1 scrollbar-thin">
          {presets.map((preset) => {
            const Icon = SETTING_ICONS[preset.key]
            const currentValue = isAdditionalSettingKey(preset.key)
              ? additionalSettings[preset.key]
              : null

            return (
              <div
                key={preset.id}
                className="rounded-xl bg-card/70 p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {Icon ? <Icon className="size-3.5" /> : null}
                    <span>{preset.label}</span>
                  </div>

                  {currentValue && isAdditionalSettingKey(preset.key) ? (
                    <button
                      type="button"
                      onClick={() => clearAdditionalSetting(preset.key)}
                      className="cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-white"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {preset.options.map((option) => {
                    const isSelected = option.value === currentValue?.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          handleToggle(preset.key, {
                            label: option.label,
                            value: option.value,
                          })
                        }
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all duration-150",
                          isSelected
                            ? "bg-white/12 text-white font-medium scale-[1.03]"
                            : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
                        )}
                      >
                        {isSelected ? (
                          <IconCheck className="size-3.5 shrink-0 text-white" />
                        ) : null}
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
