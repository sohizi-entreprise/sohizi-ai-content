import { createFileRoute } from "@tanstack/react-router"
import { MediaGenerator } from "@/features/media-generator"

export const Route = createFileRoute("/dashboard/projects/$projectId/generate")(
  {
    component: RouteComponent,
  },
)

function RouteComponent() {
  return (
    <div className="h-full min-w-0 flex-1">
      <MediaGenerator />
    </div>
  )
}
