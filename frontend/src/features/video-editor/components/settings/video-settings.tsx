import { useVideoEditorStore } from '../../store/editor-store'
import { SettingRow, SettingSection } from './setting-row'
import { SliderWithValue } from './text-settings'
import type { VideoClip } from '../../store/types'

interface VideoSettingsProps {
  clip: VideoClip
}

export function VideoSettings({ clip }: VideoSettingsProps) {
  const updateClip = useVideoEditorStore((s) => s.updateClip)

  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <SettingSection title="Basic">
        <SettingRow label="Volume">
          <SliderWithValue
            min={0}
            max={100}
            value={Math.round(clip.volume * 100)}
            onChange={(v) => updateClip(clip.id, { volume: v / 100 })}
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
        <SettingRow label="Speed">
          <SliderWithValue
            min={0.25}
            max={4}
            step={0.05}
            value={Number(clip.speed.toFixed(2))}
            onChange={(v) => updateClip(clip.id, { speed: v })}
          />
        </SettingRow>
        <SettingRow label="Round">
          <SliderWithValue
            min={0}
            max={200}
            value={clip.borderRadius}
            onChange={(v) => updateClip(clip.id, { borderRadius: v })}
          />
        </SettingRow>
      </SettingSection>
    </div>
  )
}
