import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { TopNav } from './top-nav'
import { ActivityBar } from './activity-bar'
import { FileExplorer } from '../sidebar/file-explorer'
import { EditorWorkspace } from '../workspace/editor-workspace'
import { useEditorStore } from '../../stores/editor-store'
import { ChatContainer } from '@/features/chat'

interface LayoutProps {
  projectId: string
  rootFolderId: string
}

function ExpandedLayout({ projectId, rootFolderId }: LayoutProps) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={15} minSize={10} maxSize={25} className="bg-sidebar">
        <FileExplorer projectId={projectId} rootFolderId={rootFolderId} />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={60} minSize={30}>
        <EditorWorkspace />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={25} minSize={22} maxSize={40}>
        <ChatContainer projectId={projectId} editorType="synopsis" />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function CollapsedLayout({ projectId }: LayoutProps) {
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize={75} minSize={40}>
        <EditorWorkspace />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={25} minSize={25} maxSize={40}>
        <ChatContainer projectId={projectId} editorType="synopsis" />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export function AppLayout({ projectId, rootFolderId }: LayoutProps) {
  const sidebarCollapsed = useEditorStore((s) => s.sidebarCollapsed)

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TopNav />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ActivityBar />
        <div className="relative h-full min-w-0 flex-1">
          {sidebarCollapsed ? <CollapsedLayout projectId={projectId} rootFolderId={rootFolderId} /> : <ExpandedLayout projectId={projectId} rootFolderId={rootFolderId} />}
        </div>
      </div>
    </div>
  )
}
