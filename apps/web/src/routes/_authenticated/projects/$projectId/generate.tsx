import { createFileRoute } from "@tanstack/react-router"
import { MediaGenerator } from "@/features/media-generator"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/generate",
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="h-full min-w-0 flex-1">
      <MediaGenerator />
    </div>
  )
}
