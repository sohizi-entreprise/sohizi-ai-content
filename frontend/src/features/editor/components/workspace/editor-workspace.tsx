import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { useEditorStore } from '../../stores/editor-store'
import { EditorTabs } from './editor-tabs'
import { ContentRouter } from './content-router'

function PaneContent({ pane }: { pane: 'left' | 'right' }) {
  const openTabs = useEditorStore((s) => s.openTabs)
  const activePaneTab = useEditorStore((s) => s.activePaneTab)
  const paneTabs = openTabs.filter((t) => t.pane === pane)
  const activeId = activePaneTab[pane]
  const activeTab = paneTabs.find((t) => t.id === activeId) ?? paneTabs[0]

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <EditorTabs tabs={paneTabs} activeTabId={activeTab?.id ?? null} pane={pane} />
      <div className="relative flex-1 overflow-hidden">
        {activeTab ? (
          <ContentRouter tab={activeTab} />
        ) : (
          <EmptyPane />
        )}
      </div>
    </div>
  )
}

function EmptyPane() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
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

export function EditorWorkspace() {
  const splitView = useEditorStore((s) => s.splitView)

  if (!splitView) {
    return <PaneContent pane="left" />
  }

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={50} minSize={25}>
        <PaneContent pane="left" />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50} minSize={25}>
        <PaneContent pane="right" />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
