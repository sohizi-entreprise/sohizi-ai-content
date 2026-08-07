import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { VideoEditor } from '@/features/video-editor'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute(
  '/dashboard/projects/$projectId/video-editor/$fileNodeId',
)({
  component: RouteComponent,
})

function RouteComponent() {
  const { projectId, fileNodeId } = Route.useParams()

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
          <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground hover:text-foreground">
            <Link
              to="/dashboard/projects/$projectId/video-editor"
              params={{ projectId }}
            >
              <ArrowLeft className="size-4" />
              All videos
            </Link>
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          <VideoEditor projectId={projectId} fileNodeId={fileNodeId} key={fileNodeId} />
        </div>
      </div>
    </DndProvider>
  )
}
