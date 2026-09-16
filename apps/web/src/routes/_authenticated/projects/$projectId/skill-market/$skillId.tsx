import { createFileRoute } from "@tanstack/react-router"
import { SkillMarketDetailPage } from "@/features/skill-market"

export const Route = createFileRoute(
  "/_authenticated/projects/$projectId/skill-market/$skillId",
)({
  component: RouteComponent,
})

function RouteComponent() {
  return <SkillMarketDetailPage />
}
