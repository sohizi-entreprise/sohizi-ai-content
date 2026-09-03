import { useMemo, useState } from "react"
import { ChevronDown, Monitor, RectangleHorizontal } from "lucide-react"
import {
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandYoutube,
} from "@tabler/icons-react"
import { Button } from "@sohizi/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@sohizi/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@sohizi/ui/popover"
import { useVideoEditorStore } from "../../store/editor-store"
import type { ReactNode } from "react"
import type { AspectRatio } from "../../store/types"
import { cn } from "@/lib/utils"

type AspectPreset = {
  id: string
  label: string
  ratio: AspectRatio
  icon: ReactNode
  group: "standard" | "social"
}

const ASPECT_PRESETS: Array<AspectPreset> = [
  {
    id: "landscape",
    label: "Landscape",
    ratio: "16:9",
    icon: <RectangleHorizontal className="size-4" />,
    group: "standard",
  },
  {
    id: "square",
    label: "Square",
    ratio: "1:1",
    icon: <Monitor className="size-4" />,
    group: "standard",
  },
  {
    id: "youtube",
    label: "YouTube",
    ratio: "16:9",
    icon: <IconBrandYoutube className="size-4" />,
    group: "social",
  },
  {
    id: "youtube-short",
    label: "YouTube Short",
    ratio: "9:16",
    icon: <IconBrandYoutube className="size-4" />,
    group: "social",
  },
  {
    id: "tiktok",
    label: "TikTok",
    ratio: "9:16",
    icon: <IconBrandTiktok className="size-4" />,
    group: "social",
  },
  {
    id: "instagram-reel",
    label: "Instagram Reel",
    ratio: "9:16",
    icon: <IconBrandInstagram className="size-4" />,
    group: "social",
  },
  {
    id: "instagram-portrait",
    label: "Instagram Portrait",
    ratio: "4:5",
    icon: <IconBrandInstagram className="size-4" />,
    group: "social",
  },
]

export function AspectRatioPicker() {
  const [open, setOpen] = useState(false)
  const [presetId, setPresetId] = useState<string | null>(null)
  const aspectRatio = useVideoEditorStore((s) => s.aspectRatio)
  const setAspectRatio = useVideoEditorStore((s) => s.setAspectRatio)

  const activePreset = useMemo(() => {
    const byId = ASPECT_PRESETS.find((preset) => preset.id === presetId)
    if (byId && byId.ratio === aspectRatio) return byId
    return ASPECT_PRESETS.find((preset) => preset.ratio === aspectRatio)
  }, [presetId, aspectRatio])

  const standardPresets = ASPECT_PRESETS.filter((p) => p.group === "standard")
  const socialPresets = ASPECT_PRESETS.filter((p) => p.group === "social")

  const select = (preset: AspectPreset) => {
    setPresetId(preset.id)
    setAspectRatio(preset.ratio)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {activePreset?.icon ?? <RectangleHorizontal className="size-4" />}
          {aspectRatio}
          <ChevronDown className="size-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-64 p-0"
      >
        <Command>
          <CommandInput placeholder="Search ratios..." className="h-9" />
          <CommandList>
            <CommandEmpty>No aspect ratio found.</CommandEmpty>
            <CommandGroup>
              {standardPresets.map((preset) => (
                <AspectPresetItem
                  key={preset.id}
                  preset={preset}
                  selected={activePreset?.id === preset.id}
                  onSelect={() => select(preset)}
                />
              ))}
            </CommandGroup>
            <CommandGroup heading="Social">
              {socialPresets.map((preset) => (
                <AspectPresetItem
                  key={preset.id}
                  preset={preset}
                  selected={activePreset?.id === preset.id}
                  onSelect={() => select(preset)}
                />
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function AspectPresetItem({
  preset,
  selected,
  onSelect,
}: {
  preset: AspectPreset
  selected: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`${preset.label} ${preset.ratio}`}
      onSelect={onSelect}
      className={cn(selected && "bg-accent")}
    >
      {preset.icon}
      <span className="flex-1">{preset.label}</span>
      <span className="text-xs text-muted-foreground">{preset.ratio}</span>
    </CommandItem>
  )
}
