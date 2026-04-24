import { X, SplitSquareHorizontal, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  FileText,
  FileVideo,
  FileAudio,
  FileCode,
  File,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EditorTab } from '../../types'
import { useVideoEditorStore } from '../../stores/editor-store'

function getTabIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'md':
      return <FileText className="size-3.5 shrink-0 text-blue-400" />
    case 'vid':
    case 'mp4':
    case 'mov':
      return <FileVideo className="size-3.5 shrink-0 text-purple-400" />
    case 'mp3':
    case 'wav':
      return <FileAudio className="size-3.5 shrink-0 text-green-400" />
    case 'json':
    case 'js':
    case 'ts':
      return <FileCode className="size-3.5 shrink-0 text-yellow-400" />
    default:
      return <File className="size-3.5 shrink-0 text-muted-foreground" />
  }
}

interface EditorTabsProps {
  tabs: EditorTab[]
  activeTabId: string | null
  pane: 'left' | 'right'
}

export function EditorTabs({ tabs, activeTabId, pane }: EditorTabsProps) {
  const setActiveTab = useVideoEditorStore((s) => s.setActiveTab)
  const closeTab = useVideoEditorStore((s) => s.closeTab)
  const moveTabToPane = useVideoEditorStore((s) => s.moveTabToPane)
  const toggleSplitView = useVideoEditorStore((s) => s.toggleSplitView)
  const splitView = useVideoEditorStore((s) => s.splitView)

  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center border-b border-border bg-background overflow-x-auto">
      <div className="flex items-center">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'group relative flex h-9 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors',
              activeTabId === tab.id
                ? 'bg-background text-foreground'
                : 'bg-muted/30 text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {activeTabId === tab.id && (
              <div className="absolute inset-x-0 top-0 h-px bg-primary" />
            )}
            {getTabIcon(tab.name)}
            <span className="truncate max-w-[120px]">{tab.name}</span>
            <button
              className="ml-1 flex size-4 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-accent/50 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                closeTab(tab.id)
              }}
            >
              <X className="size-3" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex size-4 items-center justify-center rounded-sm opacity-0 transition-opacity hover:bg-accent/50 group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() =>
                    moveTabToPane(tab.id, pane === 'left' ? 'right' : 'left')
                  }
                >
                  <SplitSquareHorizontal className="mr-2 size-4" />
                  Move to {pane === 'left' ? 'Right' : 'Left'} Pane
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => closeTab(tab.id)}>
                  <X className="mr-2 size-4" />
                  Close
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center pr-2">
        <button
          onClick={toggleSplitView}
          className={cn(
            'flex size-7 items-center justify-center rounded-sm transition-colors',
            splitView
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <SplitSquareHorizontal className="size-4" />
        </button>
      </div>
    </div>
  )
}
