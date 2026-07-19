import { ReactNode, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MediaTuning } from '../types'
import { useMediaCatalog } from '../hooks/use-media-catalog'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CatalogModel } from '@/features/admin/types'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaVoiceSelector } from './media-voice-selector'
import { listGoogleVoicesQueryOptions } from '../query-mutations'
import { useQuery } from '@tanstack/react-query'



export default function SettingsPopover() {

  const updatePromptSettings = useMediaGeneratorStore((state) => state.updatePromptSettings)
  const promptSettings = useMediaGeneratorStore((state) => state.promptSettings)
  const mediaType = useMediaGeneratorStore((state) => state.mediaType)
  const {
      models,
      selectedModelId,
      setSelectedModelId,
      options,
      isLoadingModels,
    } = useMediaCatalog(mediaType)

  const { data: voices = [], isLoading } = useQuery(listGoogleVoicesQueryOptions)

  useEffect(()=>{
    if (selectedModelId && mediaType !== 'audio') {
      updatePromptSettings(mediaType, 'model', selectedModelId)
    }
  }, [selectedModelId, mediaType])

  if(mediaType === 'audio'){
    return <MediaVoiceSelector voices={voices} isLoading={isLoading} />
  }

  
    return (
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-lg bg-white/12 px-3 text-xs text-white hover:bg-white/16 hover:text-white"
            >
              Settings
              <ChevronsUpDown className="size-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent
            className="w-[min(760px,calc(100vw-32px))] max-w-[760px] rounded-xl border-white/8 bg-[#1e2022] p-4 text-white shadow-2xl"
          >
            <DialogHeader>
              <DialogTitle className="text-white">Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <SelectModel models={models} selectedModelId={selectedModelId} setSelectedModelId={setSelectedModelId} isLoadingModels={isLoadingModels} />
              {
                  options.map((setting) => (
                      <OptionRow key={setting.label} label={setting.label}>
                          <SegmentedOptions
                              value={promptSettings[mediaType][setting.key] ?? ''}
                              options={setting.options}
                              onChange={(value) => updatePromptSettings(mediaType, setting.key, value)}
                          />
                      </OptionRow>
                  ))
              }
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

function SelectModel(props: {models: CatalogModel[], selectedModelId: string | null, setSelectedModelId: (modelId: string) => void, isLoadingModels: boolean}){
  const {models, selectedModelId, setSelectedModelId, isLoadingModels} = props
  if(isLoadingModels) return (
    <Skeleton className="h-8 w-[180px] rounded-lg"/>
  )
  return (
    <Select
      value={selectedModelId ?? undefined}
      onValueChange={setSelectedModelId}
      disabled={isLoadingModels}
    >
      <SelectTrigger className="h-8 w-[180px] rounded-lg border-white/10 bg-white/8 text-xs">
        <SelectValue placeholder={isLoadingModels ? 'Loading…' : 'Select model'} />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>

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
