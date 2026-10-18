import {
  IconAdjustmentsHorizontalFilled,
  IconAspectRatio,
  IconBook,
  IconBrandYoutube,
  IconListTree,
  IconMoodSmile,
  IconMovie,
  IconPuzzle,
  IconUserSquare,
  IconUsers,
} from "@tabler/icons-react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { Label } from "@sohizi/ui/label"
import { getProjectOptionsQueryOptions } from "../query-mutation"
import {
  isAdditionalSettingKey,
  useNewProjectStore,
} from "../store/new-project-store"
import type { IconProps } from "@tabler/icons-react"
import type { ForwardRefExoticComponent, RefAttributes } from "react"
import type { ProjectPreset, ProjectPresetIllustration } from "../type"
import type { SettingOption } from "../store/new-project-store"

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
  const [selectedKey, setSelectedKey] = useState("format")
  const { setAdditionalSetting, additionalSettings } = useNewProjectStore()
  const content: ProjectPreset | undefined =
    presets.find((preset) => preset.key === selectedKey) ??
    (presets.length > 0 ? presets[0] : undefined)
  const currentValue =
    content && isAdditionalSettingKey(content.key)
      ? additionalSettings[content.key]
      : null

  const handleSelect = (option: SettingOption) => {
    if (!content || !isAdditionalSettingKey(content.key)) {
      return
    }
    setAdditionalSetting(content.key, option)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="h-auto gap-1.5 rounded-full bg-card text-base px-3 py-1.5 font-normal text-foreground hover:bg-card/50 cursor-pointer">
          <IconAdjustmentsHorizontalFilled className="size-4" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-6xl h-[80%] max-h-200 bg-surface p-0 rounded-xl">
        <DialogDescription className="sr-only">
          Projects settings
        </DialogDescription>
        <div className="flex gap-4 h-full min-h-0">
          <div className="flex flex-col gap-2 bg-white/10 p-4 rounded-l-xl overflow-y-auto overscroll-y-none">
            <DialogHeader>
              <DialogTitle>Project Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {presets.map((preset) => {
                const Icon = SETTING_ICONS[preset.key]
                const isSelected = preset.key === content?.key
                return (
                  <div
                    key={preset.id}
                    className={`flex items-center gap-2 w-full px-4 py-2 rounded-lg cursor-pointer ${isSelected ? "bg-primary/15 font-medium text-primary" : "hover:bg-gray-200/10"}`}
                    onClick={() => setSelectedKey(preset.key)}
                  >
                    {Icon ? <Icon className="size-4" /> : null}
                    {preset.label}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {content ? (
              <div className="space-y-4">
                <Label>{content.label.toUpperCase()}</Label>
                <div className="grid grid-cols-4 gap-4">
                  {content.options.map((option) => (
                    <SettingItem
                      key={option.value}
                      label={option.label}
                      value={option.value}
                      illustration={option.illustration}
                      onClick={handleSelect}
                      isSelected={option.value === currentValue?.value}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type SettingItemProps = {
  label: string
  value: string
  illustration: ProjectPresetIllustration
  onClick: (option: SettingOption) => void
  isSelected?: boolean
}

function SettingItem({
  label,
  value,
  illustration,
  onClick,
  isSelected,
}: SettingItemProps) {
  return (
    <button
      className="cursor-pointer duration-300 space-y-2 group"
      onClick={() => onClick({ label, value })}
    >
      <div
        className={`flex justify-center items-center bg-gray-200 rounded-xl overflow-hidden aspect-3/4 group-hover:scale-105 transition-all duration-300 ring-2 ${isSelected ? "ring-primary ring-offset-2 ring-offset-gray-800" : "ring-transparent"}`}
      >
        <SettingIllustration illustration={illustration} label={label} />
      </div>
      <Label
        className={`text-base transition-all duration-300 ${isSelected ? "text-primary font-semibold" : "group-hover:text-primary"}`}
      >
        {label}
      </Label>
    </button>
  )
}

function SettingIllustration({
  illustration,
  label,
}: {
  illustration: ProjectPresetIllustration
  label: string
}) {
  if (!illustration.url) {
    return (
      <img
        className="w-1/2 object-contain"
        src="/imgPlaceholder.jpeg"
        alt={label}
      />
    )
  }

  if (illustration.type === "video") {
    return (
      <video
        className="h-full w-full object-cover"
        src={illustration.url}
        muted
        loop
        autoPlay
        playsInline
      />
    )
  }

  return (
    <img
      className="h-full w-full object-cover object-top"
      src={illustration.url}
      alt={label}
    />
  )
}
