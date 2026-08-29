import { useEffect, useRef } from 'react'
import {
  ChevronLeft,
  Images,
  Loader2,
  SlidersHorizontal,
  Subtitles,
  Type,
  Upload,
} from 'lucide-react'
import { useVideoEditorStore } from '../../store/editor-store'
import { useVideoEditorUiStore } from '../../store/ui-store'
import { useSelectedClip } from '../../hooks/use-selected-clip'
import { useMediaUpload } from '../../hooks/use-media-upload'
import { AssetsPanel } from '../settings/add/assets-panel'
import { TextPresetsPanel } from '../settings/add/text-presets-panel'
import { LibraryDragLayer } from '../settings/add/library-drag-layer'
import { CLIP_TYPE_LABEL, ClipSettings } from '../settings/settings-panel'
import { CaptionsLibrary } from './captions-library'
import type { LeftPanelTab } from '../../store/ui-store'
import type { ComponentType, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LeftPanelProps {
  projectId: string
}

const RAIL_ITEMS: Array<{
  id: LeftPanelTab
  label: string
  icon: ComponentType<{ className?: string }>
}> = [
  { id: 'assets', label: 'Assets', icon: Images },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'captions', label: 'Captions', icon: Subtitles },
  { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
]

export function LeftPanel({ projectId }: LeftPanelProps) {
  const leftTab = useVideoEditorUiStore((s) => s.leftTab)
  const lastLibraryTab = useVideoEditorUiStore((s) => s.lastLibraryTab)
  const setLeftTab = useVideoEditorUiStore((s) => s.setLeftTab)
  const selectedClip = useSelectedClip()

  // Selecting a clip reveals its settings; deselecting returns to the library
  // section the user was last browsing.
  const hadSelectionRef = useRef(false)
  useEffect(() => {
    const hasSelection = selectedClip !== null
    if (hasSelection && !hadSelectionRef.current) setLeftTab('adjust')
    if (!hasSelection && hadSelectionRef.current) setLeftTab(lastLibraryTab)
    hadSelectionRef.current = hasSelection
  }, [selectedClip, lastLibraryTab, setLeftTab])

  const activeTab: LeftPanelTab =
    leftTab === 'adjust' && !selectedClip ? lastLibraryTab : leftTab

  const activeIndex = RAIL_ITEMS.findIndex((item) => item.id === activeTab)

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden rounded-xl bg-card ring-1 ring-border/50">
      <LibraryDragLayer />

      <nav
        className="relative flex w-14 shrink-0 flex-col border-r border-border/40 bg-muted/15 px-1.5 py-2"
        aria-label="Library sections"
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-1.5 top-2 z-0 h-12 rounded-lg bg-muted/70',
            'transition-[transform,opacity] duration-300 ease-out',
            activeIndex < 0 && 'opacity-0',
          )}
          style={{
            transform: `translateY(${Math.max(activeIndex, 0) * 3}rem)`,
          }}
        >
          <span className="absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary/80" />
        </span>

        {RAIL_ITEMS.map((item) => (
          <RailButton
            key={item.id}
            label={item.label}
            icon={item.icon}
            active={activeTab === item.id}
            disabled={item.id === 'adjust' && !selectedClip}
            onClick={() => setLeftTab(item.id)}
          />
        ))}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-card">
        {activeTab === 'assets' ? (
          <AssetsLibrary projectId={projectId} />
        ) : null}
        {activeTab === 'text' ? <TextLibrary /> : null}
        {activeTab === 'captions' ? (
          <CaptionsLibrary projectId={projectId} />
        ) : null}
        {activeTab === 'adjust' && selectedClip ? <AdjustSection /> : null}
      </div>
    </div>
  )
}

function RailButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  active: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative z-10 flex h-12 flex-col items-center justify-center gap-1 rounded-lg transition-colors',
        'text-muted-foreground hover:text-foreground',
        active && 'text-foreground',
        disabled && 'pointer-events-none opacity-30',
      )}
    >
      <Icon
        className={cn(
          'size-4 stroke-[1.75] transition-colors',
          active && 'text-primary',
        )}
      />
      <span className="text-[9px] leading-none font-medium">{label}</span>
    </button>
  )
}

function SectionHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: ReactNode
}) {
  return (
    <div className="shrink-0 px-3.5 pt-3.5 pb-3">
      <div className="min-w-0 flex items-center justify-between gap-2">
        <h2 className="truncate text-sm font-medium text-foreground">
          {title}
        </h2>
        {children}
      </div>
      {description ? (
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function AssetsLibrary({ projectId }: LeftPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { uploadFiles, isUploading } = useMediaUpload(projectId)

  return (
    <>
      <SectionHeader
        title="Assets"
        description="Loaded from the project assets folder"
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          Upload
        </Button>
      </SectionHeader>
      <div className="min-h-0 flex-1 overflow-hidden">
        <AssetsPanel projectId={projectId} />
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void uploadFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </>
  )
}

function TextLibrary() {
  return (
    <>
      <SectionHeader title="Text" description="Drag a style to the timeline" />
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5">
        <TextPresetsPanel />
      </div>
    </>
  )
}

function AdjustSection() {
  const clearSelection = useVideoEditorStore((s) => s.clearSelection)
  const selectedClip = useSelectedClip()
  if (!selectedClip) return null

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 px-2.5 pt-3 pb-2.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground"
          onClick={clearSelection}
          aria-label="Back to library"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium text-foreground">
            {CLIP_TYPE_LABEL[selectedClip.type]}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Clip settings
          </p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-3.5">
        <ClipSettings clip={selectedClip} />
      </div>
    </>
  )
}
