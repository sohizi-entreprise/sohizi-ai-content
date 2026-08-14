import { createFileRoute } from '@tanstack/react-router'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { VideoEditor } from '@/features/video-editor'

export const Route = createFileRoute(
  '/dashboard/projects/$projectId/video-editor/$fileNodeId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { projectId, fileNodeId } = Route.useParams()

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
