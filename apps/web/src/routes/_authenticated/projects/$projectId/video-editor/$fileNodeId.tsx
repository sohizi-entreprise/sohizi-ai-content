import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { RoutePending } from "@/components/layout/route-pending"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/video-editor/$fileNodeId",
)({
  ssr: false,
  pendingComponent: () => <RoutePending label="Loading video editor..." />,
  component: lazyRouteComponent(() =>
    import("./-video-editor-session").then((module) => ({
      default: module.VideoEditorSession,
    })),
  ),
})
