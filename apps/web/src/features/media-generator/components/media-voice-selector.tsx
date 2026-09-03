import { useEffect, useRef, useState } from "react"
import { Button } from "@sohizi/ui/button"
import { Skeleton } from "@sohizi/ui/skeleton"
import { useMediaGeneratorStore } from "../store/media-generator-store"
import type { GoogleVoiceDescription } from "../requests"
import {
  VoiceSelector,
  VoiceSelectorBullet,
  VoiceSelectorContent,
  VoiceSelectorDescription,
  VoiceSelectorEmpty,
  VoiceSelectorGender,
  VoiceSelectorInput,
  VoiceSelectorItem,
  VoiceSelectorList,
  VoiceSelectorName,
  VoiceSelectorPreview,
  VoiceSelectorTrigger,
} from "@/components/ai-elements/voice-selector"

export function MediaVoiceSelector({
  voices,
  isLoading,
}: {
  voices: Array<GoogleVoiceDescription>
  isLoading: boolean
}) {
  const updatePromptSettings = useMediaGeneratorStore(
    (state) => state.updatePromptSettings,
  )
  const selectedVoice = useMediaGeneratorStore(
    (state) => state.promptSettings.audio.voice,
  )

  const [open, setOpen] = useState(false)
  const [playingVoice, setPlayingVoice] = useState<string | null>(null)
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const stopPreview = () => {
    audioRef.current?.pause()
    audioRef.current = null
    setPlayingVoice(null)
    setLoadingVoice(null)
  }

  const handleSelect = (voiceName: string) => {
    updatePromptSettings("audio", "voice", voiceName)
    stopPreview()
    setOpen(false)
  }

  const handlePreview = (voiceName: string) => {
    const voice = voices.find((item) => item.name === voiceName)
    if (!voice) return

    if (playingVoice === voiceName) {
      stopPreview()
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setLoadingVoice(voiceName)

    const audio = new Audio(voice.previewUrl)
    audioRef.current = audio

    audio.addEventListener("canplaythrough", () => {
      setLoadingVoice(null)
      setPlayingVoice(voiceName)
      void audio.play()
    })

    audio.addEventListener("ended", () => {
      setPlayingVoice(null)
    })

    audio.addEventListener("error", () => {
      setLoadingVoice(null)
      setPlayingVoice(null)
    })

    audio.load()
  }

  const selectedVoiceData = voices.find((voice) => voice.name === selectedVoice)

  if (isLoading) {
    return <Skeleton className="h-8 w-28 rounded-lg" />
  }

  return (
    <VoiceSelector
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) stopPreview()
        setOpen(nextOpen)
      }}
      value={selectedVoice}
      onValueChange={(value) => {
        if (value) {
          updatePromptSettings("audio", "voice", value)
        }
      }}
    >
      <VoiceSelectorTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full justify-start rounded-xl border bg-background px-3 text-sm hover:bg-accent/40"
        >
          {selectedVoiceData ? (
            <>
              <VoiceSelectorName>{selectedVoiceData.name}</VoiceSelectorName>
              <VoiceSelectorBullet />
              <VoiceSelectorGender value={selectedVoiceData.gender} />
            </>
          ) : (
            <span className="text-muted-foreground">Select voice</span>
          )}
        </Button>
      </VoiceSelectorTrigger>
      <VoiceSelectorContent className="max-w-md" title="Select a voice">
        <VoiceSelectorInput placeholder="Search voices..." />
        <VoiceSelectorList>
          <VoiceSelectorEmpty>No voices found.</VoiceSelectorEmpty>
          {voices.map((voice) => (
            <VoiceItem
              key={voice.name}
              voice={voice}
              playingVoice={playingVoice}
              loadingVoice={loadingVoice}
              onSelect={handleSelect}
              onPreview={handlePreview}
            />
          ))}
        </VoiceSelectorList>
      </VoiceSelectorContent>
    </VoiceSelector>
  )
}

function VoiceItem({
  voice,
  playingVoice,
  loadingVoice,
  onSelect,
  onPreview,
}: {
  voice: GoogleVoiceDescription
  playingVoice: string | null
  loadingVoice: string | null
  onSelect: (name: string) => void
  onPreview: (name: string) => void
}) {
  return (
    <VoiceSelectorItem value={voice.name} onSelect={() => onSelect(voice.name)}>
      <VoiceSelectorPreview
        loading={loadingVoice === voice.name}
        playing={playingVoice === voice.name}
        onPlay={() => onPreview(voice.name)}
      />
      <VoiceSelectorName>{voice.name}</VoiceSelectorName>
      <VoiceSelectorDescription>{voice.description}</VoiceSelectorDescription>
      <VoiceSelectorBullet />
      <VoiceSelectorGender value={voice.gender} />
    </VoiceSelectorItem>
  )
}
