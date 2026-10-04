import { ResizablePanel, ResizablePanelGroup } from "@sohizi/ui/resizable"
import { VideoTimeline } from "../timeline/timeline"
import {
  ClipSettingsDrawer,
  FileSystemVideoEditorHeader,
  PanelHandle,
  TimelineToolbar,
} from "./layout"
import { Stage } from "./stage/stage"
import { VideoEditorSession } from "./video-editor-session"

interface FileSystemVideoEditorProps {
  projectId: string
  fileNodeId: string
  fileName: string
  filePath: string
}

export function FileSystemVideoEditor({
  projectId,
  fileNodeId,
  fileName,
  filePath,
}: FileSystemVideoEditorProps) {
  return (
    <VideoEditorSession projectId={projectId} fileNodeId={fileNodeId}>
      <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-surface">
        <FileSystemVideoEditorHeader fileName={fileName} filePath={filePath} />

        <ResizablePanelGroup
          direction="vertical"
          autoSaveId="file-system-video-editor:vertical"
          className="min-h-0 flex-1 p-2"
        >
          <ResizablePanel
            id="stage-row"
            order={1}
            defaultSize={62}
            minSize={30}
            className="h-full min-h-0"
          >
            <ClipSettingsDrawer
              stage={<Stage />}
              file={{ name: fileName, path: filePath }}
            />
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
              <TimelineToolbar iconOnly showInsertTools projectId={projectId} />
              <div className="min-h-0 flex-1 overflow-hidden">
                <VideoTimeline />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </VideoEditorSession>
  )
}
