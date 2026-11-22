import { DndProvider } from "react-dnd"
import { HTML5Backend } from "react-dnd-html5-backend"
import { useParams } from "@tanstack/react-router"
import { VideoEditor } from "@/features/video-editor"

export function VideoEditorSession() {
  const { projectId, fileNodeId } = useParams({
    from: "/_authenticated/projects/$projectId/video-editor/$fileNodeId",
  })

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <VideoEditor
          projectId={projectId}
          fileNodeId={fileNodeId}
          key={fileNodeId}
        />
      </div>
    </DndProvider>
  )
}
