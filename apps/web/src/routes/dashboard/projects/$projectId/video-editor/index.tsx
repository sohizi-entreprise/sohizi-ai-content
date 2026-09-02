import { createFileRoute } from "@tanstack/react-router"
import { VideoEditorListPage } from "@/features/video-editor/components/video-editor-list-page"

export const Route = createFileRoute(
  "/dashboard/projects/$projectId/video-editor/",
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <VideoEditorListPage />
}
