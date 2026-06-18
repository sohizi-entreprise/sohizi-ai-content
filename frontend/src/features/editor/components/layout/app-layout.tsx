import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FileExplorer } from '../sidebar/file-explorer'
import { EditorWorkspace } from '../workspace/editor-workspace'
import { useEditorStore } from '../../stores/editor-store'
import { ChatContainer } from '@/features/chat'

interface LayoutProps {
  projectId: string
  rootFolderId: string
}

function ExpandedLayout({ projectId, rootFolderId }: LayoutProps) {
  const showAiPanel = useEditorStore((s) => s.showAiPanel)
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel id="file-explorer" order={1} defaultSize={15} minSize={10} maxSize={25} className="rounded-2xl mb-2 bg-card">
        <FileExplorer projectId={projectId} rootFolderId={rootFolderId} />
      </ResizablePanel>
      <ResizableHandle className='mx-1 bg-transparent'/>
      <ResizablePanel id="editor-workspace" order={2} defaultSize={showAiPanel ? 63 : 85} minSize={30} className="">
        <EditorWorkspace />
      </ResizablePanel>
      {
        showAiPanel && (
          <>
            <ResizableHandle className='mx-1 bg-transparent'/>
            <ResizablePanel id="ai-panel" order={3} defaultSize={22} minSize={22} maxSize={40} className="rounded-2xl mb-2">
              <ChatContainer projectId={projectId} editorType="synopsis" />
            </ResizablePanel>
          </>
        )
      }
    </ResizablePanelGroup>
  )
}

function CollapsedLayout({ projectId }: LayoutProps) {
  const showAiPanel = useEditorStore((s) => s.showAiPanel)
  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel id="editor-workspace" order={1} defaultSize={showAiPanel ? 78 : 100} minSize={40} className="">
        <EditorWorkspace />
      </ResizablePanel>
      {
        showAiPanel && (
          <>
            <ResizableHandle className='mx-1 bg-transparent'/>
            <ResizablePanel id="ai-panel" order={2} defaultSize={22} minSize={22} maxSize={40} className="rounded-xl mb-2 bg-card">
              <ChatContainer projectId={projectId} editorType="synopsis" />
            </ResizablePanel>
          </>
        )
      }
    </ResizablePanelGroup>
  )
}

export function AppLayout({ projectId, rootFolderId }: LayoutProps) {
  const sidebarCollapsed = useEditorStore((s) => s.sidebarCollapsed)

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="relative h-full min-w-0 flex-1">
        {sidebarCollapsed ? (
          <CollapsedLayout projectId={projectId} rootFolderId={rootFolderId} />
        ) : (
          <ExpandedLayout projectId={projectId} rootFolderId={rootFolderId} />
        )}
      </div>
    </DndProvider>
  )
}
