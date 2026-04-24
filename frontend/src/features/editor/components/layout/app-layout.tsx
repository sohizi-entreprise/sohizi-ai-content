import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { TopNav } from './top-nav'
import { ActivityBar } from './activity-bar'
import { FileExplorer } from '../sidebar/file-explorer'
import { EditorWorkspace } from '../workspace/editor-workspace'
import { AIPanel } from './ai-panel'
import { useVideoEditorStore } from '../../stores/editor-store'

function ExpandedLayout() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-sidebar">
        <FileExplorer />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={60} minSize={30}>
        <EditorWorkspace />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
        <AIPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function CollapsedLayout() {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={75} minSize={40}>
        <EditorWorkspace />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={25} minSize={18} maxSize={40}>
        <AIPanel />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export function AppLayout() {
  const sidebarCollapsed = useVideoEditorStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar />
        <div className="relative h-full min-w-0 flex-1">
          {sidebarCollapsed ? <CollapsedLayout /> : <ExpandedLayout />}
        </div>
      </div>
    </div>
  )
}
