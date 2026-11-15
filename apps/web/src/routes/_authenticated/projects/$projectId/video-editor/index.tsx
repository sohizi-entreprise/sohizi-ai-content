import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router"
import { RoutePending } from "@/components/layout/route-pending"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/video-editor/",
)({
  ssr: false,
  pendingComponent: () => <RoutePending label="Loading video editor..." />,
  component: lazyRouteComponent(
    () => import("@/features/video-editor/components/video-editor-list-page"),
    "VideoEditorListPage",
  ),
})
