import { useVideoEditorStore } from '../../store/editor-store'
import { SettingRow, SettingSection } from './setting-row'
import { SliderWithValue } from './text-settings'
import type { ImageClip } from '../../store/types'

interface ImageSettingsProps {
  clip: ImageClip
}

export function ImageSettings({ clip }: ImageSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SettingSection title="Basic">
        <SettingRow label="Round">
          <SliderWithValue
            min={0}
            max={200}
            value={clip.borderRadius}
            onChange={(v) => updateClip(clip.id, { borderRadius: v })}
          />
        </SettingRow>
        <SettingRow label="Opacity">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.opacity * 100)}
            onChange={(v) => updateClip(clip.id, { opacity: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Blur">
          <SliderWithValue
            min={0}
            max={20}
            step={0.5}
            value={Number(clip.blur.toFixed(1))}
            onChange={(v) => updateClip(clip.id, { blur: v })}
          />
        </SettingRow>
        <SettingRow label="Brightness">
          <SliderWithValue
            min={0}
            max={200}
            value={Math.round(clip.brightness)}
            onChange={(v) => updateClip(clip.id, { brightness: v })}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="Position">
        <SettingRow label="Horizontal">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.xRatio * 100)}
            onChange={(v) => updateClip(clip.id, { xRatio: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Vertical">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.yRatio * 100)}
            onChange={(v) => updateClip(clip.id, { yRatio: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Width">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(clip.widthRatio * 100)}
            onChange={(v) => updateClip(clip.id, { widthRatio: v / 100 })}
          />
        </SettingRow>
        <SettingRow label="Height">
          <SliderWithValue
            min={5}
            max={100}
            value={Math.round(clip.heightRatio * 100)}
            onChange={(v) => updateClip(clip.id, { heightRatio: v / 100 })}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}
