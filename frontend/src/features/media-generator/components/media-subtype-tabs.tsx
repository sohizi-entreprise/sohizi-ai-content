import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AUDIO_SUBTYPES, VIDEO_SUBTYPES } from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import type { AudioSubtype, VideoSubtype } from '../types'

export function MediaSubtypeTabs() {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore((state) => state.generationSubtype)
  const setGenerationSubtype = useMediaGeneratorStore((state) => state.setGenerationSubtype)

  if (generationType !== 'video' && generationType !== 'audio') {
    return null
  }

  const options = generationType === 'video' ? VIDEO_SUBTYPES : AUDIO_SUBTYPES

  return (
    <Tabs
      value={generationSubtype ?? options[0].value}
      onValueChange={(value) =>
        setGenerationSubtype(value as VideoSubtype | AudioSubtype)
      }
    >
      <TabsList className="h-9 w-full rounded-xl bg-black/30 p-1">
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className={cn(
              'flex-1 rounded-lg px-2 text-xs text-muted-foreground',
              'data-[state=active]:bg-primary/15 data-[state=active]:text-primary',
            )}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
