import { Sparkles } from 'lucide-react'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import {
  aspectRatios,
  audioModels,
  cameraAngles,
  imageModels,
  mediaTypeOptions,
  resolutions,
  videoModels,
  voices,
} from '../constants'
import type {
  AudioGenerationSettings,
  ImageGenerationSettings,
  MediaAspectRatio,
  MediaResolution,
  MediaType,
  VideoGenerationSettings,
} from '../types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type MediaSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaSettingsDialog({
  open,
  onOpenChange,
}: MediaSettingsDialogProps) {
  const activeType = useMediaGeneratorStore((state) => state.activeType)
  const setActiveType = useMediaGeneratorStore((state) => state.setActiveType)
  const settings = useMediaGeneratorStore((state) => state.settings)
  const updateSettings = useMediaGeneratorStore((state) => state.updateSettings)
  const generateMedia = useMediaGeneratorStore((state) => state.generateMedia)
  const prompt = useMediaGeneratorStore((state) => state.settingsPrompt)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950/95 p-0 text-white shadow-2xl sm:max-w-2xl h-150 max-h-[80vh] overflow-y-auto flex flex-col">
        <div className="border-b border-white/10 p-5">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="size-5 text-primary" />
              Media generator settings
            </DialogTitle>
            <DialogDescription>
              Choose a media type and tune the generation settings.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Tabs
          value={activeType}
          onValueChange={(value) => setActiveType(value as MediaType)}
          className="gap-0 flex-1 px-4"
        >
            <TabsList className="h-11 w-full justify-start rounded-2xl border border-white/10 bg-black/40 p-1">
              {mediaTypeOptions.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="rounded-xl text-sm text-zinc-300 data-[state=active]:bg-white/15 data-[state=active]:text-white"
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>

          <div className="space-y-5 py-5">

            <TabsContent value="image" className="mt-0">
              <ImageSettings
                settings={settings.image}
                update={(patch) => updateSettings('image', patch)}
              />
            </TabsContent>
            <TabsContent value="video" className="mt-0">
              <VideoSettings
                settings={settings.video}
                update={(patch) => updateSettings('video', patch)}
              />
            </TabsContent>
            <TabsContent value="audio" className="mt-0">
              <AudioSettings
                settings={settings.audio}
                update={(patch) => updateSettings('audio', patch)}
              />
            </TabsContent>

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/3 p-3">
              <p className="max-w-sm text-xs text-muted-foreground">
                This version creates local mock media so you can test the full
                workflow before generation APIs are connected.
              </p>
              <Button
                onClick={() => {
                  generateMedia({ type: activeType, prompt })
                  onOpenChange(false)
                }}
                className="rounded-full"
              >
                Generate
              </Button>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}


function ImageSettings({
  settings,
  update,
}: {
  settings: ImageGenerationSettings
  update: (patch: Partial<ImageGenerationSettings>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Model type"
        value={settings.model}
        options={imageModels}
        onChange={(model) => update({ model })}
      />
      <SliderField
        label="Variations"
        value={settings.variations}
        min={1}
        max={4}
        step={1}
        suffix=""
        onChange={(variations) => update({ variations })}
      />
      <SelectField
        label="Camera angle"
        value={settings.cameraAngle}
        options={cameraAngles}
        onChange={(cameraAngle) => update({ cameraAngle })}
      />
      <SelectField
        label="Resolution"
        value={settings.resolution}
        options={resolutions}
        onChange={(resolution) =>
          update({ resolution: resolution as MediaResolution })
        }
      />
      <SelectField
        label="Aspect ratio"
        value={settings.aspectRatio}
        options={aspectRatios}
        onChange={(aspectRatio) =>
          update({ aspectRatio: aspectRatio as MediaAspectRatio })
        }
      />
    </div>
  )
}

function VideoSettings({
  settings,
  update,
}: {
  settings: VideoGenerationSettings
  update: (patch: Partial<VideoGenerationSettings>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Model type"
        value={settings.model}
        options={videoModels}
        onChange={(model) => update({ model })}
      />
      <SliderField
        label="Duration"
        value={settings.duration}
        min={3}
        max={12}
        step={1}
        suffix="s"
        onChange={(duration) => update({ duration })}
      />
      <SelectField
        label="Resolution"
        value={settings.resolution}
        options={resolutions}
        onChange={(resolution) =>
          update({ resolution: resolution as MediaResolution })
        }
      />
      <SelectField
        label="Aspect ratio"
        value={settings.aspectRatio}
        options={aspectRatios}
        onChange={(aspectRatio) =>
          update({ aspectRatio: aspectRatio as MediaAspectRatio })
        }
      />
    </div>
  )
}

function AudioSettings({
  settings,
  update,
}: {
  settings: AudioGenerationSettings
  update: (patch: Partial<AudioGenerationSettings>) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField
        label="Model"
        value={settings.model}
        options={audioModels}
        onChange={(model) => update({ model })}
      />
      <SelectField
        label="Voice"
        value={settings.voice}
        options={voices}
        onChange={(voice) => update({ voice })}
      />
      <SliderField
        label="Speed"
        value={settings.speed}
        min={0.5}
        max={1.5}
        step={0.1}
        suffix="x"
        onChange={(speed) => update({ speed })}
      />
      <SliderField
        label="Stability"
        value={settings.stability}
        min={0}
        max={100}
        step={5}
        suffix="%"
        onChange={(stability) => update({ stability })}
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/3 p-3">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full border-white/10 bg-black/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-white/10 bg-zinc-950 text-white">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/3 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-sm text-zinc-300">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([nextValue]) => onChange(nextValue)}
      />
    </div>
  )
}
