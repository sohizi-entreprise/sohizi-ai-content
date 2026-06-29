import {
  useRef,
} from 'react'
import {
  AudioLines,
  Clapperboard,
  ImageIcon,
  RefreshCw,
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
  onGenerate?: (payload: MediaChatGeneratePayload) => void | Promise<void>
  isGenerating?: boolean
  className?: string
}

const TABS: Array<{ value: MediaType; label: string; icon: LucideIcon }> = [
  { value: 'video', label: 'Video Generation', icon: Clapperboard },
  { value: 'image', label: 'Image Generation', icon: ImageIcon },
  { value: 'audio', label: 'Audio Generation', icon: AudioLines },
]


export function MediaChatInput({
  projectId,
  className,
}: MediaChatInputProps) {

  const setMediaType = useMediaGeneratorStore((state) => state.setMediaType)
  const mediaType = useMediaGeneratorStore((state) => state.mediaType)

  const currentSettings = useMediaGeneratorStore((state) => state.settings[mediaType])

  const addAttachment = useMediaGeneratorStore((state) => state.addAttachment)
  const removeAttachment = useMediaGeneratorStore((state) => state.removeAttachment)
  const attachments = useMediaGeneratorStore((state) => state.attachments)

  const updateSettings = useMediaGeneratorStore((state) => state.updateSettings)
  const setPrompt = useMediaGeneratorStore((state) => state.setPrompt)

  const reset = useMediaGeneratorStore((state) => state.reset)
 
  const editorRef = useRef<Editor | null>(null)

  const supportsImageAttachments = mediaType !== 'audio'

  const { sendRequest, isPending, disableButton } = useSendRequest(projectId)
  

  const handleSettingsUpdate = (key:string, value:string) => {
    updateSettings(mediaType, key, value)
  }

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-background p-3 text-foreground',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-1/4 top-0 h-16 w-56 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative z-1">
        <div className="flex items-start justify-between gap-3">
          <Tabs
            value={mediaType}
            onValueChange={(value) => setMediaType(value as MediaType)}
            className="min-w-0 flex-1"
          >
            <TabsList className="h-9 w-full justify-start gap-1 rounded-none bg-transparent p-0">
              {TABS.map((tab) => {
                const Icon = tab.icon

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className={cn(
                      'h-9 flex-none rounded-t-2xl rounded-b-none border-0 bg-transparent px-4 text-sm text-zinc-400 shadow-none',
                      'data-[state=active]:bg-white/8 data-[state=active]:text-white data-[state=active]:shadow-[0_0_34px_rgba(255,255,255,0.12)]',
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={reset}
            className="h-8 shrink-0 rounded-lg px-2 text-xs text-zinc-300 hover:bg-white/8 hover:text-white"
          >
            <RefreshCw className="size-3.5" />
            Reset
          </Button>
        </div>

        <div className="mt-5 flex items-start gap-6 px-1">
          {supportsImageAttachments ? (
            <FileAttachment
              projectId={projectId}
              attachments={attachments}
              onAdd={addAttachment}
              onRemove={removeAttachment}
              maxAttachments={5}
            />
          ) : null}

          <div className="max-h-[100px] min-w-0 flex-1 overflow-y-auto">
            <ChatTextarea
              projectId={projectId}
              onChange={setPrompt}
              placeholder="Write your prompt, use @ to reference files ..."
              editorRef={editorRef}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <SettingsPopover
            settings={currentSettings}
            onUpdate={handleSettingsUpdate}
          />

          <Button
            type="button"
            disabled={disableButton}
            onClick={sendRequest}
            className="ml-auto h-9 min-w-35 rounded-lg bg-linear-to-r from-emerald-500 to-lime-400 px-6 font-semibold text-black hover:from-emerald-400 hover:to-lime-300 disabled:opacity-50"
          >
            {isPending ? <IconLoader2 className="size-4 animate-spin" /> : 'Generate'}
          </Button>
        </div>
      </div>
    </section>
  )
}

