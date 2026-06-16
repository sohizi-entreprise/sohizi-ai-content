import {
  MoreVertical,
  SplitSquareHorizontal,
  X,
} from 'lucide-react'
import { useMemo } from 'react'
import { useEditorStore } from '../../stores/editor-store'
import type { EditorTab } from '../../types'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getFileIcon } from '../../utils/get-file-icon'


interface EditorTabsProps {
  tabs: Array<EditorTab>
  activeTabId: string | null
  pane: 'left' | 'right'
}

export function EditorTabs({ tabs, activeTabId, pane }: EditorTabsProps) {
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const closeTab = useEditorStore((s) => s.closeTab)
  const closePane = useEditorStore((s) => s.closePane)
  const toggleSplitView = useEditorStore((s) => s.toggleSplitView)
  const splitView = useEditorStore((s) => s.splitView)
  const setSelectedFileId = useEditorStore((s) => s.setSelectedFileId)

  const handleSplitViewClick = () => {
    if (splitView) {
      closePane(pane)
      return
    }

    toggleSplitView()
  }

  const handleTabClick = (tabId: string) => {
    return () => {
      setActiveTab(tabId)
      setSelectedFileId(tabId)
    }
  }

  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center overflow-x-auto overflow-y-hidden bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-none pl-8">
      <div className="flex items-center">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'group relative flex h-9 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors',
              activeTabId === tab.id
                ? 'bg-surface text-foreground rounded-t-2xl rounded-out-b-lg'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={handleTabClick(tab.id)}
          >
            {getFileIcon(tab.format ?? '', tab.name)}
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
            <TabMenu tab={tab} pane={pane} />
          </div>
        ))}
      </div>

      <div className="ml-auto flex items-center pr-2">
        <button
          onClick={handleSplitViewClick}
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

function TabMenu({ tab, pane }: { tab: EditorTab; pane: 'left' | 'right' }) {
  const { id: tabId } = tab
  const moveTabToPane = useEditorStore((s) => s.moveTabToPane)
  const closeTab = useEditorStore((s) => s.closeTab)

  const tabMenuOptions = useMemo(
    () => [
      {
        label: `Move to ${pane === 'left' ? 'Right' : 'Left'} Pane`,
        icon: <SplitSquareHorizontal className="mr-2 size-4" />,
        onClick: () => moveTabToPane(tabId, pane === 'left' ? 'right' : 'left'),
      },
      {
        label: 'Close',
        icon: <X className="mr-2 size-4" />,
        onClick: () => closeTab(tabId),
      },
    ],
    [tabId, pane],
  )

  return (
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
        {tabMenuOptions.map((option, index) => (
          <DropdownMenuItem key={index} onClick={option.onClick}>
            {option.icon}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
