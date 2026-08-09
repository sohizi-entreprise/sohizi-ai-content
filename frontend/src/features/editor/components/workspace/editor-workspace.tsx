import { useEditorStore } from '../../stores/editor-store'
import { EditorTabs } from './editor-tabs'
import { ContentRouter } from './content-router'

export function EditorWorkspace() {
  const openTabs = useEditorStore((s) => s.openTabs)
  const activeTabId = useEditorStore((s) => s.activeTabId)
  const activeTab =
    openTabs.find((t) => t.id === activeTabId) ?? openTabs[0] ?? null

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <EditorTabs tabs={openTabs} activeTabId={activeTab?.id ?? null} />
      <div className="relative flex-1 overflow-y-auto rounded-t-xl bg-surface">
        {activeTab ? <ContentRouter tab={activeTab} /> : <EmptyPane />}
      </div>
    </div>
  )
}

function EmptyPane() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="flex size-16 items-center justify-center rounded-xl border border-dashed border-border">
          <span className="text-2xl font-light">S</span>
        </div>
        <p className="text-sm">Open a file from the explorer</p>
        <p className="text-xs text-muted-foreground/60">Cmd+P to quick open</p>
      </div>
    </div>
  )
}
