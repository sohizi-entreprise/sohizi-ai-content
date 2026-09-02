import { X } from "lucide-react"
import { useEditorStore } from "../../stores/editor-store"
import { getFileIcon } from "../../utils/get-file-icon"
import type { EditorTab } from "../../types"
import { cn } from "@/lib/utils"

interface EditorTabsProps {
  tabs: Array<EditorTab>
  activeTabId: string | null
}

export function EditorTabs({ tabs, activeTabId }: EditorTabsProps) {
  const setActiveTab = useEditorStore((s) => s.setActiveTab)
  const closeTab = useEditorStore((s) => s.closeTab)
  const setSelectedFileId = useEditorStore((s) => s.setSelectedFileId)

  const handleTabClick = (tabId: string) => {
    return () => {
      setActiveTab(tabId)
      setSelectedFileId(tabId)
    }
  }

  if (tabs.length === 0) return null

  return (
    <div className="flex h-9 shrink-0 items-center overflow-x-auto overflow-y-hidden bg-background [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-none pl-8 mr-2">
      <div className="flex items-center">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              "group relative flex h-9 cursor-pointer items-center gap-1.5 px-3 text-xs transition-colors",
              activeTabId === tab.id
                ? "bg-surface text-foreground rounded-t-2xl rounded-out-b-lg"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={handleTabClick(tab.id)}
          >
            {getFileIcon(tab.format ?? "", tab.name)}
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
          </div>
        ))}
      </div>
    </div>
  )
}
