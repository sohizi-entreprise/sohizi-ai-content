import { ReactNode } from 'react'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MediaTuning } from '../types'


type Props = {
    settings: MediaTuning[]
    onUpdate: (key: string, value: string) => void
}

export default function SettingsPopover(props: Props) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-8 rounded-lg bg-white/12 px-3 text-xs text-white hover:bg-white/16 hover:text-white"
          >
            Settings
            <ChevronsUpDown className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="top"
          sideOffset={10}
          className="w-[min(760px,calc(100vw-32px))] rounded-xl border-white/8 bg-[#1e2022] p-4 text-white shadow-2xl"
        >
          <div className="space-y-4">
            {
                props.settings.map((setting) => (
                    <OptionRow key={setting.label} label={setting.label}>
                        <SegmentedOptions
                            value={setting.currentValue ?? ''}
                            options={setting.options}
                            onChange={(value) => props.onUpdate(setting.key, value)}
                        />
                    </OptionRow>
                ))
            }
          </div>
        </PopoverContent>
      </Popover>
    )
  }

function OptionRow({
    label,
    children,
  }: {
    label: string
    children: ReactNode
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          {label}
        </div>
        {children}
      </div>
    )
}

function SegmentedOptions({
    value,
    options,
    onChange,
  }: {
    value: string
    options: MediaTuning['options']
    onChange: (value: string) => void
  }) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(64px,1fr))] overflow-hidden rounded-lg bg-white/6 p-0">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative h-8 rounded-lg text-xs text-zinc-300 transition',
              value === option.value && 'bg-white/20 text-white',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  }
