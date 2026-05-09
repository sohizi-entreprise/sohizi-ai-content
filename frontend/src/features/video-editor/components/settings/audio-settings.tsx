import { useVideoEditorStore } from '../../store/editor-store'
import { SettingRow, SettingSection } from './setting-row'
import { SliderWithValue } from './text-settings'
import type { AudioClip } from '../../store/types'

interface AudioSettingsProps {
  clip: AudioClip
}

export function AudioSettings({ clip }: AudioSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SettingSection title="Basic">
        <SettingRow label="Speed">
          <SliderWithValue
            min={0.25}
            max={4}
            step={0.05}
            value={Number(clip.speed.toFixed(2))}
            onChange={(v) => updateClip(clip.id, { speed: v })}
          />
        </SettingRow>
        <SettingRow label="Volume">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.volume * 100)}
            onChange={(v) => updateClip(clip.id, { volume: v / 100 })}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}
