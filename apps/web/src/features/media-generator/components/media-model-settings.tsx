import { useEffect } from "react"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Textarea } from "@sohizi/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sohizi/ui/select"
import { Slider } from "@sohizi/ui/slider"
import { Switch } from "@sohizi/ui/switch"
import { Skeleton } from "@sohizi/ui/skeleton"
import { useMediaCatalog } from "../hooks/use-media-catalog"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import { AssetPickerField } from "./asset-picker-dialog"
import { MediaModelSelector } from "./media-model-selector"
import type { ReactNode } from "react"
import type { ModelParameterBinding } from "@/features/admin/types"
import { cn } from "@/lib/utils"

type MediaModelSettingsProps = {
  projectId: string
  errors: Record<string, string>
  isLoadingParameters: boolean
  parameters: Array<ModelParameterBinding>
  resetErrors: () => void
}

export function MediaModelSettings(props: MediaModelSettingsProps) {
  const { projectId, errors, isLoadingParameters, parameters, resetErrors } =
    props

  const parameterValues = useMediaGeneratorStore(
    (state) => state.parameterValues,
  )
  const updateParameterValue = useMediaGeneratorStore(
    (state) => state.updateParameterValue,
  )
  const {
    models,
    selectedModelId,
    setSelectedModelId,
    isLoadingModels,
    hasCatalog,
  } = useMediaCatalog()

  const handleParameterChange = (key: string, value: string) => {
    updateParameterValue(key, value)
    resetErrors()
  }

  useEffect(() => {
    resetErrors()
  }, [selectedModelId])

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
          No models are configured for this mode yet.
        </p>
      )}

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
                error={errors[parameter.key]}
                key={parameter.parameterId}
                projectId={projectId}
                parameter={parameter}
                value={
                  (parameterValues[parameter.key] as string | undefined) ??
                  parameter.defaultValue ??
                  ""
                }
                onChange={(value) =>
                  handleParameterChange(parameter.key, value)
                }
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

function ParameterLabel({
  parameter,
  error,
}: {
  parameter: ModelParameterBinding
  error?: string
}) {
  return (
    <Label
      className={cn("text-xs text-foreground", error && "text-destructive")}
    >
      {parameter.label}
      {parameter.required ? (
        <span className="ml-0.5 text-destructive" aria-hidden="true">
          *
        </span>
      ) : null}
    </Label>
  )
}

export function ParameterField({
  projectId,
  parameter,
  value,
  onChange,
  error,
}: {
  projectId: string
  parameter: ModelParameterBinding
  value: string
  onChange: (value: string) => void
  error: string | undefined
}) {
  const component = parameter.xUiComponent

  if (component === "textarea") {
    return (
      <div className="space-y-2">
        <ParameterLabel parameter={parameter} error={error} />
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={parameter.description ?? undefined}
          className="min-h-20 rounded-xl resize-none bg-background! max-h-40"
          aria-invalid={Boolean(error)}
        />
      </div>
    )
  }

  if (component === "select" && parameter.options.length > 0) {
    return (
      <div className="space-y-2">
        <ParameterLabel parameter={parameter} error={error} />
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="h-11 w-full rounded-xl dark:bg-background dark:hover:bg-accent/40">
            <SelectValue
              placeholder={`Select ${parameter.label.toLowerCase()}`}
            />
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

  if (component === "slider" || parameter.type === "number") {
    const min = parameter.constraints?.min ?? 0
    const max = parameter.constraints?.max ?? 100
    const step = parameter.constraints?.step ?? 1
    const numericValue = Number(value)
    const safeValue = Number.isFinite(numericValue) ? numericValue : min

    if (component === "slider") {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <ParameterLabel parameter={parameter} error={error} />
            <span className="text-xs text-muted-foreground">{safeValue}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[safeValue]}
            onValueChange={([next]) => onChange(String(next))}
            className="**:data-[slot=slider-track]:bg-background"
          />
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <ParameterLabel parameter={parameter} error={error} />
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

  if (component === "uploader") {
    return (
      <div className="space-y-2">
        <ParameterLabel parameter={parameter} error={error} />
        <AssetPickerField
          projectId={projectId}
          parameter={parameter}
          value={value}
          onChange={onChange}
        />
        {parameter.description ? (
          <p className="text-xs text-muted-foreground">
            {parameter.description}
          </p>
        ) : null}
      </div>
    )
  }

  if (component === "checkbox" || parameter.type === "boolean") {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
        <ParameterLabel parameter={parameter} error={error} />
        <Switch
          checked={value === "true"}
          onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ParameterLabel parameter={parameter} error={error} />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={parameter.description ?? undefined}
        className="h-11 rounded-xl"
      />
    </div>
  )
}
