import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ModelParameterBinding } from '@/features/admin/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import FileAttachment, { type AttachedFile } from '@/components/widgets/file-attachments'
import { MediaVoiceSelector } from './media-voice-selector'
import { listGoogleVoicesQueryOptions } from '../query-mutations'
import { useMediaCatalog } from '../hooks/use-media-catalog'
import { useModelParameters } from '../hooks/use-model-parameters'
import { showsVoiceSelector } from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { MediaModelSelector } from './media-model-selector'

type MediaModelSettingsProps = {
  projectId: string
}

export function MediaModelSettings({ projectId }: MediaModelSettingsProps) {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore((state) => state.generationSubtype)
  const parameterValues = useMediaGeneratorStore((state) => state.parameterValues)
  const updateParameterValue = useMediaGeneratorStore((state) => state.updateParameterValue)
  const {
    models,
    selectedModelId,
    setSelectedModelId,
    isLoadingModels,
    hasCatalog,
  } = useMediaCatalog()
  const { parameters, isLoadingParameters } = useModelParameters()
  const { data: voices = [], isLoading: isLoadingVoices } = useQuery(listGoogleVoicesQueryOptions)
  const showVoice = showsVoiceSelector(generationType, generationSubtype)

  return (
    <div className="space-y-5">
      {hasCatalog ? (
        <SettingsField label="Model">
          {models.length === 0 && !isLoadingModels ? (
            <p className="text-sm text-muted-foreground">
              No models are configured for this mode yet.
            </p>
          ) : (
            <MediaModelSelector
              models={models}
              selectedModelId={selectedModelId}
              onSelect={setSelectedModelId}
              isLoading={isLoadingModels}
            />
          )}
        </SettingsField>
      ) : (
        <p className="text-sm text-muted-foreground">
          This mode uses the project agent. Describe what you want in the prompt below.
        </p>
      )}

      {showVoice ? (
        <SettingsField label="Voice">
          <MediaVoiceSelector voices={voices} isLoading={isLoadingVoices} />
        </SettingsField>
      ) : null}

      {hasCatalog && selectedModelId ? (
        isLoadingParameters ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full rounded-xl" />
          </div>
        ) : parameters.length > 0 ? (
          <div className="space-y-4">
            <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Settings
            </p>
            {parameters.map((parameter) => (
              <ParameterField
                key={parameter.parameterId}
                projectId={projectId}
                parameter={parameter}
                value={parameterValues[parameter.key] ?? parameter.defaultValue ?? ''}
                onChange={(value) => updateParameterValue(parameter.key, value)}
              />
            ))}
          </div>
        ) : null
      ) : null}
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

function ParameterField({
  projectId,
  parameter,
  value,
  onChange,
}: {
  projectId: string
  parameter: ModelParameterBinding
  value: string
  onChange: (value: string) => void
}) {
  const component = parameter.xUiComponent

  if (component === 'select' && parameter.options.length > 0) {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{parameter.label}</Label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="h-11 w-full rounded-xl">
            <SelectValue placeholder={`Select ${parameter.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {parameter.options.map((option) => (
              <SelectItem key={option.id} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (component === 'slider' || parameter.type === 'number') {
    const min = parameter.constraints?.min ?? 0
    const max = parameter.constraints?.max ?? 100
    const step = parameter.constraints?.step ?? 1
    const numericValue = Number(value)
    const safeValue = Number.isFinite(numericValue) ? numericValue : min

    if (component === 'slider') {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{parameter.label}</Label>
            <span className="text-xs text-muted-foreground">{safeValue}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[safeValue]}
            onValueChange={([next]) => onChange(String(next))}
          />
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{parameter.label}</Label>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-xl"
        />
      </div>
    )
  }

  if (component === 'uploader') {
    return (
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{parameter.label}</Label>
        <ParameterUploader
          projectId={projectId}
          fileType={parameter.constraints?.fileType}
          onUploaded={(url) => onChange(url)}
        />
        {parameter.description ? (
          <p className="text-xs text-muted-foreground">{parameter.description}</p>
        ) : null}
      </div>
    )
  }

  if (parameter.type === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <Label className="text-xs text-muted-foreground">{parameter.label}</Label>
        <Switch
          checked={value === 'true'}
          onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{parameter.label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={parameter.description ?? undefined}
        className="h-11 rounded-xl"
      />
    </div>
  )
}

function ParameterUploader({
  projectId,
  fileType,
  onUploaded,
}: {
  projectId: string
  fileType?: 'image' | 'video' | 'audio'
  onUploaded: (url: string) => void
}) {
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const accept =
    fileType === 'video' ? 'video/*' : fileType === 'audio' ? 'audio/*' : 'image/*'

  const addAttachment = (attachment: AttachedFile) => {
    setAttachments((current) => {
      const index = current.findIndex((item) => item.id === attachment.id)
      if (index >= 0) {
        return current.map((item) => (item.id === attachment.id ? attachment : item))
      }
      return [attachment]
    })
    if (attachment.status === 'uploaded') {
      onUploaded(attachment.url)
    }
  }

  const removeAttachment = (id: string) => {
    setAttachments((current) => current.filter((item) => item.id !== id))
    onUploaded('')
  }

  return (
    <div className="flex min-h-20 items-center rounded-xl border border-dashed px-3">
      <FileAttachment
        projectId={projectId}
        attachments={attachments}
        onAdd={addAttachment}
        onRemove={removeAttachment}
        maxAttachments={1}
        itemSize={48}
        accept={accept}
      />
      {attachments.length === 0 ? (
        <p className="ml-3 text-xs text-muted-foreground">
          Drag & drop or click to upload
        </p>
      ) : null}
    </div>
  )
}
