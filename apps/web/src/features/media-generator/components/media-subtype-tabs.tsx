import { Tabs, TabsList, TabsTrigger } from "@sohizi/ui/tabs"
import { AUDIO_SUBTYPES, IMAGE_SUBTYPES, VIDEO_SUBTYPES } from "../constants"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import type { GenerationSubtype } from "../types"

const SUBTYPE_OPTIONS = {
  image: IMAGE_SUBTYPES,
  video: VIDEO_SUBTYPES,
  audio: AUDIO_SUBTYPES,
} as const

export function MediaSubtypeTabs() {
  const generationType = useMediaGeneratorStore((state) => state.generationType)
  const generationSubtype = useMediaGeneratorStore(
    (state) => state.generationSubtype,
  )
  const setGenerationSubtype = useMediaGeneratorStore(
    (state) => state.setGenerationSubtype,
  )

  if (
    generationType !== "image" &&
    generationType !== "video" &&
    generationType !== "audio"
  ) {
    return null
  }

  const options = SUBTYPE_OPTIONS[generationType]

  return (
    <Tabs
      value={generationSubtype ?? options[0].value}
      onValueChange={(value) =>
        setGenerationSubtype(value as GenerationSubtype)
      }
    >
      <TabsList className="w-full rounded-xl">
        {options.map((option) => (
          <TabsTrigger key={option.value} value={option.value}>
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
