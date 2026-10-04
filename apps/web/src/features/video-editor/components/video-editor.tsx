import { ResizablePanel, ResizablePanelGroup } from "@sohizi/ui/resizable"
import { VideoTimeline } from "../timeline/timeline"
import {
  ChatPanel,
  EditorTopBar,
  LeftPanel,
  PanelHandle,
  TimelineToolbar,
} from "./layout"
import { Stage } from "./stage/stage"
import { VideoEditorSession } from "./video-editor-session"
import { useEditorStore } from "@/features/editor/stores/editor-store"

interface VideoEditorProps {
  projectId: string
  fileNodeId: string
}

export function VideoEditor({ projectId, fileNodeId }: VideoEditorProps) {
  return (
    <VideoEditorSession projectId={projectId} fileNodeId={fileNodeId}>
      <VideoEditorWorkspace projectId={projectId} fileNodeId={fileNodeId} />
    </VideoEditorSession>
  )
}

function VideoEditorWorkspace({ projectId, fileNodeId }: VideoEditorProps) {
  const isChatOpen = useEditorStore((s) => s.chatOpenByContext["video-editor"])

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <EditorTopBar projectId={projectId} fileNodeId={fileNodeId} />

      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="video-editor:outer-horizontal"
        className="min-h-0 flex-1 p-2"
      >
        <ResizablePanel
          id="main"
          order={1}
          defaultSize={isChatOpen ? 76 : 100}
          minSize={50}
          className="min-w-0"
        >
          <ResizablePanelGroup
            direction="vertical"
            autoSaveId="video-editor:vertical"
            className="h-full min-h-0"
          >
            <ResizablePanel
              id="stage-row"
              order={1}
              defaultSize={62}
              minSize={30}
              className="min-h-0"
            >
              <ResizablePanelGroup
                direction="horizontal"
                autoSaveId="video-editor:horizontal"
                className="h-full min-h-0"
              >
                <ResizablePanel
                  id="library"
                  order={1}
                  defaultSize={26}
                  minSize={14}
                  maxSize={40}
                  className="min-w-0"
                >
                  <LeftPanel projectId={projectId} />
                </ResizablePanel>
                <PanelHandle />

                <ResizablePanel
                  id="stage"
                  order={2}
                  defaultSize={74}
                  minSize={40}
                  className="min-w-0"
                >
                  <Stage />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            <PanelHandle />

            <ResizablePanel
              id="timeline-row"
              order={2}
              defaultSize={38}
              minSize={22}
              className="flex min-h-0 flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-card">
                <TimelineToolbar />
                <div className="min-h-0 flex-1 overflow-hidden">
                  <VideoTimeline />
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>

        {isChatOpen ? (
          <>
            <PanelHandle />
            <ResizablePanel
              id="chat"
              order={2}
              defaultSize={24}
              minSize={16}
              maxSize={40}
              className="min-w-0"
            >
              <ChatPanel projectId={projectId} />
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  )
}
