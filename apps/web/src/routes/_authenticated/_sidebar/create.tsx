import { createFileRoute } from "@tanstack/react-router"
import StartProject from "@/features/projects/pages/start-project"

export const Route = createFileRoute("/_authenticated/_sidebar/create")({
  component: CreateProjectRoute,
})

function CreateProjectRoute() {
  return (
    <div className="py-12 sm:py-16 relative">
      <StartProject />
    </div>
  )
}
