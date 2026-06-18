import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { computePosition, flip, shift } from '@floating-ui/dom'
import { mergeAttributes } from '@tiptap/core'
import Mention from '@tiptap/extension-mention'
import Placeholder from '@tiptap/extension-placeholder'
import { PluginKey } from '@tiptap/pm/state'
import { EditorContent, ReactRenderer, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import {
  AudioLines,
  BadgeCheck,
  Check,
  ChevronsUpDown,
  Clapperboard,
  Flame,
  ImageIcon,
  Plus,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import {
  audioModels,
  defaultMediaSettings,
  imageModels,
  resolutions,
  videoModels,
  voices,
} from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import type { JSONContent } from '@tiptap/core'
import type {
  SuggestionKeyDownProps,
  SuggestionOptions,
  SuggestionProps,
} from '@tiptap/suggestion'
import type { LucideIcon } from 'lucide-react'
import type { FocusEvent, ReactNode } from 'react'
import type {
  AudioGenerationSettings,
  ImageGenerationSettings,
  MediaAspectRatio,
  MediaResolution,
  MediaType,
  VideoGenerationSettings,
} from '../types'
import type { FileMentionItem } from '@/hooks/use-file-mention-search'
import { useFileMentionSearch } from '@/hooks/use-file-mention-search'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

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

const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  image: {
    ...defaultMediaSettings.image,
    model: 'imagen-3-omni',
    seriesMode: false,
  },
  video: {
    ...defaultMediaSettings.video,
    model: 'veo-3',
    duration: 5,
    nativeAudio: true,
    multiShot: true,
    mode: 'elements',
    outputCount: 1,
  },
  audio: {
    ...defaultMediaSettings.audio,
    outputCount: 1,
  },
}

const IMAGE_MODEL_OPTIONS = [
  { value: 'imagen-3-omni', label: 'IMAGE 3.0 Omni' },
  { value: 'imagen-o1', label: 'IMAGE O1' },
  ...imageModels,
] as const

const VIDEO_MODEL_OPTIONS = [
  { value: 'veo-3', label: 'VIO 3.0' },
  ...videoModels,
] as const

const DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
const OUTPUT_OPTIONS = [1, 2, 3, 4]
const RATIO_OPTIONS: Array<MediaAspectRatio | 'auto'> = [
  'auto',
  '9:16',
  '1:1',
  '16:9',
]
const FILE_MENTION_PLUGIN_KEY = new PluginKey('mediaChatFileMention')

type FileMentionListRef = {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

type FileMentionNodeAttrs = {
  id?: string | null
  label?: string | null
  format?: string | null
}

const FileMention = Mention.extend({
  name: 'fileMention',

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attrs) => ({ 'data-id': attrs.id }),
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
      format: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-format'),
        renderHTML: (attrs) => ({ 'data-format': attrs.format }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-type="fileMention"]' }]
  },

  renderText({ node }) {
    return `@${node.attrs.label ?? node.attrs.id ?? ''}`
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-type': 'fileMention',
          class:
            'inline-flex rounded bg-white/10 px-1 py-0 text-zinc-100 ring-1 ring-white/10',
        },
        HTMLAttributes,
      ),
      `@${node.attrs.label ?? node.attrs.id ?? ''}`,
    ]
  },
})

export function MediaChatInput({
  projectId,
  onGenerate,
  isGenerating = false,
  className,
}: MediaChatInputProps) {
  const activeType = useMediaGeneratorStore((state) => state.activeType)
  const setActiveType = useMediaGeneratorStore((state) => state.setActiveType)
  const searchFiles = useFileMentionSearch(projectId)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [attachments, setAttachments] = useState<Array<ImageAttachment>>([])
  const [settings, setSettings] = useState<ComposerSettings>(
    DEFAULT_COMPOSER_SETTINGS,
  )

  const suggestion = useMemo(
    () => createFileMentionSuggestion(searchFiles),
    [searchFiles],
  )

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
        heading: false,
        horizontalRule: false,
        italic: false,
        listItem: false,
        orderedList: false,
        strike: false,
        bold: false,
      }),
      Placeholder.configure({
        placeholder:
          'Supports up to 7 reference images or elements. Use @ for quick access and define engaging interactions.',
      }),
      FileMention.configure({
        HTMLAttributes: {
          class:
            'inline-flex rounded bg-white/10 px-1 py-0 text-zinc-100 ring-1 ring-white/10',
        },
        suggestion,
      }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class:
          'media-chat-tiptap min-h-[54px] flex-1 outline-none text-sm leading-7 text-white',
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain')
        if (!text) return false

        event.preventDefault()
        view.dispatch(view.state.tr.insertText(text))
        return true
      },
    },
  })

  const prompt = editor.getText().trim()
  const supportsImageAttachments = activeType !== 'audio'
  const activeAttachments = supportsImageAttachments ? attachments : []
  const canGenerate =
    !isGenerating && (!!prompt || activeAttachments.length > 0)
  const generationCount = getGenerationCount(activeType, settings)

  const updateSettings = useCallback(
    <T extends MediaType>(type: T, patch: Partial<ComposerSettings[T]>) => {
      setSettings((current) => ({
        ...current,
        [type]: {
          ...current[type],
          ...patch,
        },
      }))
    },
    [],
  )

  const reset = useCallback(() => {
    editor.commands.clearContent()
    setAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.url))
      return []
    })
    setSettings((current) => ({
      ...current,
      [activeType]: DEFAULT_COMPOSER_SETTINGS[activeType],
    }))
  }, [activeType, editor])

  const addAttachments = useCallback((files: FileList | null) => {
    if (!files?.length) return

    const nextAttachments = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, 7)
      .map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      }))

    setAttachments((current) => {
      const availableSlots = Math.max(7 - current.length, 0)
      const accepted = nextAttachments.slice(0, availableSlots)
      nextAttachments.slice(availableSlots).forEach((attachment) => {
        URL.revokeObjectURL(attachment.url)
      })
      return [...current, ...accepted]
    })
  }, [])

  const removeAttachment = useCallback((id: string) => {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === id)
      if (removed) URL.revokeObjectURL(removed.url)
      return current.filter((attachment) => attachment.id !== id)
    })
  }, [])

  const generate = useCallback(async () => {
    if (!canGenerate) return

    await onGenerate?.({
      type: activeType,
      prompt,
      content: editor.getJSON(),
      files: collectTaggedFiles(editor.getJSON()),
      images: activeAttachments.map(
        ({ url: _url, ...attachment }) => attachment,
      ),
      settings: settings[activeType],
    })
  }, [
    activeAttachments,
    activeType,
    canGenerate,
    editor,
    onGenerate,
    prompt,
    settings,
  ])

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
            value={activeType}
            onValueChange={(value) => setActiveType(value as MediaType)}
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
            <AttachmentStrip
              attachments={attachments}
              onAdd={() => fileInputRef.current?.click()}
              onRemove={removeAttachment}
            />
          ) : null}

          <div className="max-h-[100px] min-w-0 flex-1 overflow-y-auto">
            <EditorContent
              editor={editor}
              className={cn(
                'min-w-0 pt-0.5',
                '[&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-zinc-500 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
                '[&_.ProseMirror_p]:my-0 [&_.ProseMirror]:outline-none',
              )}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              addAttachments(event.currentTarget.files)
              event.currentTarget.value = ''
            }}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {activeType === 'video' ? (
            <VideoControls
              settings={settings.video}
              update={(patch) => updateSettings('video', patch)}
            />
          ) : null}
          {activeType === 'image' ? (
            <ImageControls
              settings={settings.image}
              update={(patch) => updateSettings('image', patch)}
            />
          ) : null}
          {activeType === 'audio' ? (
            <AudioControls
              settings={settings.audio}
              update={(patch) => updateSettings('audio', patch)}
            />
          ) : null}

          <Button
            type="button"
            disabled={!canGenerate}
            onClick={() => void generate()}
            className="ml-auto h-9 min-w-35 rounded-lg bg-linear-to-r from-emerald-500 to-lime-400 px-6 font-semibold text-black hover:from-emerald-400 hover:to-lime-300 disabled:opacity-50"
          >
            <Flame className="size-4 fill-black" />
            {generationCount > 1 ? `${generationCount} ` : ''}
            Generate
          </Button>
        </div>
      </div>
    </section>
  )
}

function AttachmentStrip({
  attachments,
  onAdd,
  onRemove,
}: {
  attachments: Array<ImageAttachment>
  onAdd: () => void
  onRemove: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const maxAttachments = 7
  const visibleAttachments = attachments.slice(0, maxAttachments)
  const itemSize = 60
  const collapsedOffset = 12
  const expandedGap = 8
  const expandedStep = itemSize + expandedGap
  const addButtonIndex = visibleAttachments.length
  const canAdd = attachments.length < maxAttachments
  const collapsedWidth =
    visibleAttachments.length > 0
      ? itemSize + (visibleAttachments.length - 1) * collapsedOffset
      : itemSize
  const expandedWidth =
    (visibleAttachments.length + 1) * expandedStep - expandedGap

  useEffect(() => {
    setIsExpanded(false)
  }, [attachments.length])

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsExpanded(false)
    }
  }

  return (
    <div
      className={cn(
        'group relative h-18 shrink-0 overflow-visible py-1 transition-[z-index] duration-300',
        isExpanded ? 'z-20' : 'z-1',
      )}
      style={{ width: collapsedWidth }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onFocus={() => setIsExpanded(true)}
      onBlur={handleBlur}
    >
      <div
        className="relative h-15 min-w-15"
        style={{ width: isExpanded ? expandedWidth : collapsedWidth }}
      >
        {visibleAttachments.map((attachment, index) => {
          const collapsedX = index * collapsedOffset
          const expandedX = index * expandedStep
          const rotation = index * 5

          return (
            <div
              key={attachment.id}
              className="absolute left-0 top-0 size-15 overflow-hidden rounded-xl border border-white/10 bg-white/8 shadow-lg shadow-black/20 transition-[transform,border-color,box-shadow] duration-300 ease-out will-change-transform hover:border-white/25 hover:shadow-xl hover:shadow-black/30"
              style={{
                zIndex: isExpanded
                  ? index + 1
                  : visibleAttachments.length + index,
                transform: isExpanded
                  ? `translateX(${expandedX}px) rotate(0deg) scale(1)`
                  : `translateX(${collapsedX}px) rotate(${rotation}deg) scale(1)`,
              }}
            >
              <img
                src={attachment.url}
                alt={attachment.name}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                className={cn(
                  'absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/75 text-white shadow-sm shadow-black/30 transition-[opacity,transform,background-color] duration-200 hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                  isExpanded
                    ? 'scale-100 opacity-100'
                    : 'pointer-events-none scale-75 opacity-0',
                )}
                aria-label="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          )
        })}

        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className={cn(
            'absolute left-0 top-0 flex size-15 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/6 text-zinc-300 transition-[transform,opacity,border-color,background-color,color] duration-300 ease-out will-change-transform hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 disabled:cursor-not-allowed disabled:opacity-50',
            isExpanded || visibleAttachments.length === 0
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0',
          )}
          style={{
            zIndex: visibleAttachments.length + 2,
            transform:
              isExpanded || visibleAttachments.length === 0
                ? `translateX(${addButtonIndex * expandedStep}px) scale(1)`
                : `translateX(${Math.max(addButtonIndex - 1, 0) * collapsedOffset}px) scale(0.85)`,
          }}
          aria-label="Add reference image"
        >
          <Plus className="size-5" />
        </button>
      </div>
    </div>
  )
}

function VideoControls({
  settings,
  update,
}: {
  settings: ComposerSettings['video']
  update: (patch: Partial<ComposerSettings['video']>) => void
}) {
  return (
    <>
      <CompactSelect
        value={settings.model}
        options={VIDEO_MODEL_OPTIONS}
        icon={<BadgeCheck className="size-4" />}
        onChange={(model) => update({ model })}
      />
      <VideoSettingsPopover settings={settings} update={update} />
      <TogglePill
        checked={settings.nativeAudio}
        label="Native Audio"
        onCheckedChange={(nativeAudio) => update({ nativeAudio })}
      />
      
    </>
  )
}

function ImageControls({
  settings,
  update,
}: {
  settings: ComposerSettings['image']
  update: (patch: Partial<ComposerSettings['image']>) => void
}) {
  return (
    <>
      <CompactSelect
        value={settings.model}
        options={IMAGE_MODEL_OPTIONS}
        icon={<BadgeCheck className="size-4" />}
        onChange={(model) => update({ model })}
      />
      <CompactSelect
        value={`${settings.resolution} · Auto · ${settings.variations}`}
        options={resolutions.map((resolution) => ({
          value: `${resolution.value} · Auto · ${settings.variations}`,
          label: `${resolution.label} · Auto · ${settings.variations}`,
          resolution: resolution.value,
        }))}
        onChange={(value) => {
          const resolution = value.split(' · ')[0] as MediaResolution
          update({ resolution })
        }}
      />
    </>
  )
}

function AudioControls({
  settings,
  update,
}: {
  settings: ComposerSettings['audio']
  update: (patch: Partial<ComposerSettings['audio']>) => void
}) {
  return (
    <>
      <CompactSelect
        value={settings.model}
        options={audioModels}
        icon={<AudioLines className="size-4" />}
        onChange={(model) => update({ model })}
      />
      <CompactSelect
        value={settings.voice}
        options={voices}
        onChange={(voice) => update({ voice })}
      />
      <CompactSelect
        value={String(settings.outputCount)}
        options={OUTPUT_OPTIONS.map((output) => ({
          value: String(output),
          label: `${output} output${output > 1 ? 's' : ''}`,
        }))}
        onChange={(outputCount) => update({ outputCount: Number(outputCount) })}
      />
    </>
  )
}

function CompactSelect({
  value,
  options,
  icon,
  onChange,
}: {
  value: string
  options: ReadonlyArray<{ value: string; label: string }>
  icon?: ReactNode
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 min-w-23 rounded-lg border-white/8 bg-white/12 px-3 text-xs text-white shadow-none hover:bg-white/16">
        <span className="flex items-center gap-1.5 truncate">
          {icon}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="border-white/8 bg-[#202326] text-white">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="focus:bg-white/10 focus:text-white"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TogglePill({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onCheckedChange(!checked)}
      className="flex h-8 items-center gap-1.5 rounded-lg bg-white/12 px-3 text-xs text-white hover:bg-white/16"
    >
      <span
        className={cn(
          'flex size-4 items-center justify-center rounded-full',
          checked ? 'bg-white text-zinc-900' : 'border border-white/50',
        )}
      >
        {checked ? <Check className="size-3" /> : null}
      </span>
      {label}
    </button>
  )
}


function VideoSettingsPopover({
  settings,
  update,
}: {
  settings: ComposerSettings['video']
  update: (patch: Partial<ComposerSettings['video']>) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-8 rounded-lg bg-white/12 px-3 text-xs text-white hover:bg-white/16 hover:text-white"
        >
          {settings.outputCount}...
          <ChevronsUpDown className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-[min(760px,calc(100vw-32px))] rounded-xl border-white/8 bg-[#1e2022] p-4 text-white shadow-2xl"
      >
        <div className="space-y-4">
          <OptionRow label="Mode">
            <SegmentedOptions
              value={settings.resolution}
              options={resolutions.map((resolution) => ({
                value: resolution.value,
                label: resolution.label,
              }))}
              onChange={(resolution) =>
                update({ resolution: resolution as MediaResolution })
              }
            />
          </OptionRow>

          <OptionRow label="Duration">
            <SegmentedOptions
              value={String(settings.duration)}
              options={DURATION_OPTIONS.map((duration) => ({
                value: String(duration),
                label: `${duration}s`,
              }))}
              onChange={(duration) => update({ duration: Number(duration) })}
            />
          </OptionRow>

          <OptionRow label="Ratio">
            <SegmentedOptions
              value={settings.aspectRatio}
              options={RATIO_OPTIONS.map((ratio) => ({
                value: ratio,
                label: ratio === 'auto' ? 'Auto' : ratio,
              }))}
              onChange={(aspectRatio) => {
                if (aspectRatio === 'auto') return
                update({ aspectRatio: aspectRatio as MediaAspectRatio })
              }}
            />
          </OptionRow>

          <OptionRow label="Output">
            <SegmentedOptions
              value={String(settings.outputCount)}
              options={OUTPUT_OPTIONS.map((output) => ({
                value: String(output),
                label: String(output),
              }))}
              onChange={(outputCount) =>
                update({ outputCount: Number(outputCount) })
              }
            />
          </OptionRow>
        </div>
      </PopoverContent>
    </Popover>
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
  options: Array<{ value: string; label: string }>
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

const FileMentionList = forwardRef<
  FileMentionListRef,
  SuggestionProps<FileMentionItem>
>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = useCallback(
    (index: number) => {
      props.command(props.items[index])
    },
    [props],
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (!props.items.length) return false
        if (event.key === 'ArrowUp') {
          setSelectedIndex(
            (current) =>
              (current + props.items.length - 1) % props.items.length,
          )
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((current) => (current + 1) % props.items.length)
          return true
        }
        if (event.key === 'Enter') {
          selectItem(selectedIndex)
          return true
        }
        return false
      },
    }),
    [props.items.length, selectItem, selectedIndex],
  )

  return (
    <div className="min-w-52 rounded-md border border-white/10 bg-[#202326] p-0.5 text-white shadow-xl">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            type="button"
            key={item.id}
            className={cn(
              'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs',
              index === selectedIndex
                ? 'bg-white/12 text-white'
                : 'text-zinc-300 hover:bg-white/8',
            )}
            onMouseDown={(event) => {
              event.preventDefault()
              selectItem(index)
            }}
          >
            <Upload className="size-3.5" />
            <span className="min-w-0 flex-1 truncate">{item.display}</span>
            <span className="text-[10px] uppercase text-zinc-500">
              {item.format}
            </span>
          </button>
        ))
      ) : (
        <div className="px-2 py-1 text-xs text-zinc-400">No files found</div>
      )}
    </div>
  )
})

FileMentionList.displayName = 'FileMentionList'

function createFileMentionSuggestion(
  searchFn: (
    query: string,
    options?: { signal?: AbortSignal },
  ) => Promise<Array<FileMentionItem>>,
): Omit<SuggestionOptions<FileMentionItem>, 'editor'> {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  return {
    char: '@',
    allowSpaces: false,
    pluginKey: FILE_MENTION_PLUGIN_KEY,
    items: ({ query }) =>
      new Promise<Array<FileMentionItem>>((resolve) => {
        if (debounceTimer) clearTimeout(debounceTimer)
        if (abortController) abortController.abort()

        if (!query.trim()) {
          resolve([])
          return
        }

        debounceTimer = setTimeout(async () => {
          abortController = new AbortController()
          try {
            resolve(await searchFn(query, { signal: abortController.signal }))
          } catch {
            resolve([])
          }
        }, 150)
      }),
    command: ({ editor, range, props }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: 'fileMention',
          attrs: {
            id: props.id,
            label: props.display,
            format: props.format,
          },
        })
        .insertContent(' ')
        .run()
    },
    render: () => {
      let component: ReactRenderer<
        FileMentionListRef,
        SuggestionProps<FileMentionItem>
      > | null = null
      let scrollHandler: (() => void) | null = null

      return {
        onStart: (props) => {
          component = new ReactRenderer(FileMentionList, {
            props,
            editor: props.editor,
          })
          component.element.style.position = 'fixed'
          component.element.style.zIndex = '80'
          document.body.appendChild(component.element)
          updateSuggestionPosition(props, component.element)

          scrollHandler = () => {
            if (component) updateSuggestionPosition(props, component.element)
          }
          window.addEventListener('scroll', scrollHandler, true)
        },
        onUpdate: (props) => {
          component?.updateProps(props)
          if (component) updateSuggestionPosition(props, component.element)
        },
        onKeyDown: (props) => {
          if (props.event.key === 'Escape') {
            component?.destroy()
            return true
          }
          return component?.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          if (scrollHandler) {
            window.removeEventListener('scroll', scrollHandler, true)
            scrollHandler = null
          }
          if (debounceTimer) clearTimeout(debounceTimer)
          if (abortController) abortController.abort()
          component?.destroy()
          component = null
        },
      }
    },
  }
}

function updateSuggestionPosition(
  props: SuggestionProps<FileMentionItem>,
  element: HTMLElement,
) {
  const clientRect = props.clientRect?.()
  if (!clientRect) return

  computePosition(
    {
      getBoundingClientRect: () => clientRect,
    },
    element,
    {
      placement: 'bottom-start',
      strategy: 'fixed',
      middleware: [shift({ padding: 8 }), flip()],
    },
  ).then(({ x, y }) => {
    element.style.left = `${x}px`
    element.style.top = `${y}px`
  })
}

function getGenerationCount(type: MediaType, settings: ComposerSettings) {
  if (type === 'image') return settings.image.variations
  if (type === 'video') return settings.video.outputCount
  return settings.audio.outputCount
}

function collectTaggedFiles(content: JSONContent) {
  const files: Array<TaggedFile> = []
  const visit = (node: JSONContent) => {
    if (node.type === 'fileMention') {
      const attrs = node.attrs as FileMentionNodeAttrs | undefined
      if (attrs?.id && attrs.label && attrs.format) {
        files.push({
          id: attrs.id,
          label: attrs.label,
          format: attrs.format,
        })
      }
    }

    node.content?.forEach(visit)
  }

  visit(content)
  return files
}
