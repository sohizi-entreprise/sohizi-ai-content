import {
  useEffect,
  useRef,
} from 'react'
import {
  AudioLines,
  Clapperboard,
  ImageIcon,
  MoveUp,
} from 'lucide-react'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import type { Editor, JSONContent } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import type {
  AudioGenerationSettings,
  ImageGenerationSettings,
  MediaType,
  VideoGenerationSettings,
} from '../types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import FileAttachment from '@/components/widgets/file-attachments'
import ChatTextarea from '@/features/chat/components/chat-textarea'
import SettingsPopover from './media-settings-popover'
import { useSendRequest } from '../hooks/use-send-request'
import { IconLoader2 } from '@tabler/icons-react'

type TaggedFile = {
  id: string
  label: string
  format: string
}

type ImageAttachment = {
  id: string
  name: string
  size: number
  type: string
  url: string
}

type ComposerSettings = {
  image: ImageGenerationSettings & {
    seriesMode: boolean
  }
  video: VideoGenerationSettings & {
    nativeAudio: boolean
    multiShot: boolean
    mode: 'elements' | 'image-to-video'
    outputCount: number
  }
  audio: AudioGenerationSettings & {
    outputCount: number
  }
}

export type MediaChatGeneratePayload = {
  type: MediaType
  prompt: string
  content: JSONContent
  files: Array<TaggedFile>
  images: Array<Omit<ImageAttachment, 'url'>>
  settings: ComposerSettings[MediaType]
}

export type MediaChatInputProps = {
  projectId: string
  className?: string
}

const TABS: Array<{ value: MediaType; label: string; icon: LucideIcon }> = [
  { value: 'image', label: 'Image', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: Clapperboard },
  { value: 'audio', label: 'Audio', icon: AudioLines },
]


export function MediaChatInput({
  projectId,
  className,
}: MediaChatInputProps) {

  const setMediaType = useMediaGeneratorStore((state) => state.setMediaType)
  const mediaType = useMediaGeneratorStore((state) => state.mediaType)
  const setChatInput = useMediaGeneratorStore((state) => state.setChatInput)

  const currentSettings = useMediaGeneratorStore((state) => state.settings[mediaType])

  const addAttachment = useMediaGeneratorStore((state) => state.addAttachment)
  const removeAttachment = useMediaGeneratorStore((state) => state.removeAttachment)
  const attachments = useMediaGeneratorStore((state) => state.attachments)

  const updateSettings = useMediaGeneratorStore((state) => state.updateSettings)
  const setPrompt = useMediaGeneratorStore((state) => state.setPrompt)
 
  const editorRef = useRef<Editor | null>(null)

  const supportsImageAttachments = mediaType !== 'audio'

  const { sendRequest, isPending, disableButton } = useSendRequest(projectId)

  const handleSettingsUpdate = (key:string, value:string) => {
    updateSettings(mediaType, key, value)
  }

  useEffect(()=>{
    if (editorRef.current) {
      setChatInput(editorRef.current)
    }
    return () => {
      setChatInput(null)
    }
  },[editorRef.current, setChatInput])

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border focus-within:border-white/20 bg-background text-foreground',
        className,
      )}
    >
      {/* <div className="pointer-events-none absolute -right-1/4 top-0 h-16 w-56 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" /> */}
      <div className="relative z-1">
        <div className="flex items-start justify-between gap-3">
          <Tabs
            value={mediaType}
            onValueChange={(value) => setMediaType(value as MediaType)}
            className="min-w-0 flex-1 p-2"
          >
            <TabsList className="h-9 w-full justify-start gap-1 rounded-none bg-transparent">
              {TABS.map((tab) => {
                const Icon = tab.icon

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'relative h-9 flex-none rounded-2xl border-0 bg-transparent px-4 text-sm text-muted-foreground',
                      mediaType === tab.value && 'bg-surface/30 text-primary!',
                    )}
                  >
                    <Icon className="size-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="max-h-24 min-h-20 min-w-0 overflow-y-auto px-3">
          <ChatTextarea
            projectId={projectId}
            onChange={setPrompt}
            placeholder="Write your prompt, use @ to reference files ..."
            editorRef={editorRef}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 p-2 rounded-b-xl border-t">
        {supportsImageAttachments ? (
            <FileAttachment
              projectId={projectId}
              attachments={attachments}
              onAdd={addAttachment}
              onRemove={removeAttachment}
              maxAttachments={5}
              itemSize={40}
            />
          ) : null}

          <SettingsPopover
            settings={currentSettings}
            onUpdate={handleSettingsUpdate}
          />

          <Button
           
            disabled={disableButton}
            onClick={sendRequest}
            size="icon"
            className="ml-auto rounded-full text-black disabled:opacity-50"
          >
            {isPending ? 
            <IconLoader2 className="size-4 animate-spin" /> : 
            <MoveUp className="size-4" strokeWidth={3}/>
            }
          </Button>
        </div>
      </div>
    </section>
  )
}

