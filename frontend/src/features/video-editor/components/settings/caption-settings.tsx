import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { useVideoEditorStore } from '../../store/editor-store'
import { SettingRow, SettingSection } from './setting-row'
import { SliderWithValue } from './slider-with-value'
import type { CaptionClip, TextAlign } from '../../store/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ALIGNMENTS: Array<{ id: TextAlign; icon: typeof AlignLeft }> = [
  { id: 'left', icon: AlignLeft },
  { id: 'center', icon: AlignCenter },
  { id: 'right', icon: AlignRight },
]

export function CaptionSettings({ clip }: { clip: CaptionClip }) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)
  const properties = clip.properties

  const patch = (next: Partial<CaptionClip['properties']>) => {
    updateClip(clip.id, { properties: { ...properties, ...next } })
  }

  return (
    <div className="flex flex-col gap-5 pb-2">
      <SettingSection title="Transcript">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {clip.captions.text || 'This caption has no transcript yet.'}
        </p>
      </SettingSection>

      <SettingSection title="Styles">
        <SettingRow label="Size">
          <Input
            type="number"
            min={8}
            max={400}
            value={properties.fontSize}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (!Number.isFinite(value)) return
              patch({ fontSize: Math.max(1, value) })
            }}
            className="h-8 text-xs"
          />
        </SettingRow>

        <SettingRow label="Color">
          <ColorField
            value={properties.color}
            onChange={(color) => patch({ color })}
          />
        </SettingRow>

        <SettingRow label="Highlight">
          <ColorField
            value={properties.hightlightColor ?? '#42f042'}
            onChange={(hightlightColor) => patch({ hightlightColor })}
          />
        </SettingRow>

        <SettingRow label="Align">
          <div className="flex items-center gap-1">
            {ALIGNMENTS.map(({ id, icon: Icon }) => (
              <Button
                key={id}
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => patch({ align: id })}
                className={cn(
                  'size-8 border border-transparent',
                  properties.align === id
                    ? 'border-border bg-accent text-foreground'
                    : 'text-muted-foreground',
                )}
                title={id}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </SettingRow>

        <SettingRow label="Opacity">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(properties.opacity * 100)}
            onChange={(value) => patch({ opacity: value / 100 })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Position">
        <SettingRow label="Horizontal">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(properties.xRatio * 100)}
            onChange={(value) => patch({ xRatio: value / 100 })}
          />
        </SettingRow>
        <SettingRow label="Vertical">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(properties.yRatio * 100)}
            onChange={(value) => patch({ yRatio: value / 100 })}
          />
        </SettingRow>
        <SettingRow label="Width">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(properties.widthRatio * 100)}
            onChange={(value) => patch({ widthRatio: value / 100 })}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}

function ColorField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded-md border border-input bg-transparent"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 flex-1 text-xs"
      />
    </div>
  )
}
