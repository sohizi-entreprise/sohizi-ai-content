import { useEffect, type ReactNode } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { useMediaCatalog } from '../hooks/use-media-catalog'
import {
  AGENT_ASPECT_RATIOS,
  AGENT_MAX_REFERENCES,
  AGENT_QUALITIES,
  defaultAgentParameterValues,
  getAgentReferenceFileTypes,
} from '../lib/agent-settings'
import { ReferenceAssetPickerField } from './asset-picker-dialog'

export function MediaAgentSettings({ projectId }: { projectId: string }) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const parameterValues = useMediaGeneratorStore((state) => state.parameterValues)
  const setParameterValues = useMediaGeneratorStore((state) => state.setParameterValues)
  const updateParameterValue = useMediaGeneratorStore((state) => state.updateParameterValue)
  useMediaCatalog()
  const seeded = defaultAgentParameterValues(parameterValues)
  const fileTypes = getAgentReferenceFileTypes(generationType)

  useEffect(() => {
    if (
      parameterValues.aspectRatio
      && parameterValues.quality
      && parameterValues.references != null
    ) {
      return
    }
    setParameterValues(defaultAgentParameterValues(parameterValues))
  }, [parameterValues, setParameterValues])

  return (
    <div className="space-y-5">
      <SettingsField label="Aspect ratio">
        <Select
          value={seeded.aspectRatio}
          onValueChange={(value) => updateParameterValue('aspectRatio', value)}
        >
          <SelectTrigger className="h-11 w-full rounded-xl dark:bg-background dark:hover:bg-accent/40">
            <SelectValue placeholder="Select aspect ratio" />
          </SelectTrigger>
          <SelectContent>
            {AGENT_ASPECT_RATIOS.map((ratio) => (
              <SelectItem key={ratio} value={ratio}>
                {ratio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      <SettingsField label="Quality">
        <Select
          value={seeded.quality}
          onValueChange={(value) => updateParameterValue('quality', value)}
        >
          <SelectTrigger className="h-11 w-full rounded-xl dark:bg-background dark:hover:bg-accent/40">
            <SelectValue placeholder="Select quality" />
          </SelectTrigger>
          <SelectContent>
            {AGENT_QUALITIES.map((quality) => (
              <SelectItem key={quality} value={quality}>
                {quality.charAt(0).toUpperCase() + quality.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      <SettingsField label="References">
        <ReferenceAssetPickerField
          projectId={projectId}
          label="References"
          fileTypes={fileTypes}
          maxItems={AGENT_MAX_REFERENCES}
          value={seeded.references}
          onChange={(value) => updateParameterValue('references', value)}
        />
        <p className="text-xs text-muted-foreground">
          Optional. Up to {AGENT_MAX_REFERENCES} {generationType === 'video' ? 'image, video, or audio' : 'image'} files.
        </p>
      </SettingsField>
    </div>
  )
}

function SettingsField({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}
