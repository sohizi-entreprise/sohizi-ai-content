import { useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  Monitor,
  Plus,
  RectangleHorizontal,
  Settings2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import {
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandYoutube,
} from '@tabler/icons-react'
import { useVideoEditorStore } from '../store/editor-store'
import type { AspectRatio } from '../store/types'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type AspectPreset = {
  id: string
  label: string
  ratio: AspectRatio
  icon: ReactNode
  group: 'original' | 'social'
}

const ASPECT_PRESETS: Array<AspectPreset> = [
  {
    id: 'original',
    label: 'Original',
    ratio: '16:9',
    icon: <RectangleHorizontal className="size-4" />,
    group: 'original',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    ratio: '16:9',
    icon: <IconBrandYoutube className="size-4" />,
    group: 'social',
  },
  {
    id: 'youtube-short',
    label: 'YouTube Short',
    ratio: '9:16',
    icon: <IconBrandYoutube className="size-4" />,
    group: 'social',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    ratio: '9:16',
    icon: <IconBrandTiktok className="size-4" />,
    group: 'social',
  },
  {
    id: 'instagram-reel',
    label: 'Instagram Reel',
    ratio: '9:16',
    icon: <IconBrandInstagram className="size-4" />,
    group: 'social',
  },
  {
    id: 'square',
    label: 'Square',
    ratio: '1:1',
    icon: <Monitor className="size-4" />,
    group: 'social',
  },
  {
    id: 'instagram-portrait',
    label: 'Instagram Portrait',
    ratio: '4:5',
    icon: <IconBrandInstagram className="size-4" />,
    group: 'social',
  },
]

const actionButtonClass =
  'h-7 gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground'

export function ActionsButtons() {
  return (
    <div className="flex h-fit items-center justify-center">
      <div className="flex items-center rounded-lg bg-card px-1 py-0.5 shadow-sm ring-1 ring-border/60">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(
            actionButtonClass,
            'text-primary hover:bg-primary/15 hover:text-primary',
          )}
        >
          <Plus className="size-3.5" />
          Add clip
        </Button>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />

        <AspectRatioPicker />

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={actionButtonClass}
        >
          <Settings2 className="size-3.5" />
          Settings
        </Button>

        <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />

        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn(actionButtonClass, '')}
        >
          <Sparkles className="size-3.5" />
          Attach to context
        </Button>
      </div>
    </div>
  )
}

function AspectRatioPicker() {
  const [open, setOpen] = useState(false)
  const [selectedPresetId, setSelectedPresetId] = useState('original')
  const setAspectRatio = useVideoEditorStore((s) => s.setAspectRatio)

  const selectedPreset = useMemo(
    () =>
      ASPECT_PRESETS.find((p) => p.id === selectedPresetId) ?? ASPECT_PRESETS[0],
    [selectedPresetId],
  )

  const originalPresets = useMemo(
    () => ASPECT_PRESETS.filter((p) => p.group === 'original'),
    [],
  )
  const socialPresets = useMemo(
    () => ASPECT_PRESETS.filter((p) => p.group === 'social'),
    [],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={actionButtonClass}
        >
          {selectedPreset.icon}
          {selectedPreset.label} ({selectedPreset.ratio})
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={8}
        className="w-72 p-0"
      >
        <Command>
          <CommandInput placeholder="Search..." className="h-9" />
          <CommandList>
            <CommandEmpty>No aspect ratio found.</CommandEmpty>
            <CommandGroup>
              {originalPresets.map((preset) => (
                <AspectPresetItem
                  key={preset.id}
                  preset={preset}
                  selected={selectedPresetId === preset.id}
                  onSelect={() => {
                    setSelectedPresetId(preset.id)
                    setAspectRatio(preset.ratio)
                    setOpen(false)
                  }}
                />
              ))}
            </CommandGroup>
            <CommandGroup heading="Social">
              {socialPresets.map((preset) => (
                <AspectPresetItem
                  key={preset.id}
                  preset={preset}
                  selected={selectedPresetId === preset.id}
                  onSelect={() => {
                    setSelectedPresetId(preset.id)
                    setAspectRatio(preset.ratio)
                    setOpen(false)
                  }}
                />
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <div className="p-1">
            <button
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-foreground',
                'hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              Resize for social media
            </button>
          </div>
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
      className={cn(selected && 'bg-accent')}
    >
      {preset.icon}
      <span className="flex-1">{preset.label}</span>
      <span className="text-xs text-muted-foreground">({preset.ratio})</span>
    </CommandItem>
  )
}
