import { useEditorStore } from "../../stores/editor-store"
import { ContentRouter } from "./content-router"
import { EditorTabs } from "./editor-tabs"
import { EmptyPane } from "./empty-pane"

export function EditorWorkspace() {
  const openTabs = useEditorStore((s) => s.openTabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const activeTab =
    openTabs.find((t) => t.id === activeTabId) ?? openTabs.at(0) ?? null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <EditorTabs tabs={openTabs} activeTabId={activeTab?.id ?? null} />
      <div className="relative flex-1 overflow-y-auto rounded-t-xl bg-surface">
        {activeTab ? <ContentRouter tab={activeTab} /> : <EmptyPane />}
      </div>
    </div>
  )
}
