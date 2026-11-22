import { useSuspenseInfiniteQuery } from "@tanstack/react-query"
import { Link, useSearch } from "@tanstack/react-router"
import { IconCirclePlusFilled } from "@tabler/icons-react"
import { Button } from "@sohizi/ui/button"
import { Separator } from "@sohizi/ui/separator"
import { Skeleton } from "@sohizi/ui/skeleton"
import { getListProjectsQueryOptions } from "../query-mutation"
import StartProject from "../pages/start-project"
import ProjectCard from "./project-card"
import StepMarker from "./step-marker"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth-client"

export default function ListProjects() {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId ?? undefined

  if (!organizationId) {
    return <StartProject />
  }

  return <ListProjectsContent organizationId={organizationId} />
}

function ListProjectsContent({ organizationId }: { organizationId: string }) {
  const { data: projects = [] } = useSuspenseInfiniteQuery(
    getListProjectsQueryOptions({
      cursor: undefined,
      limit: 20,
      organizationId,
    }),
  )
  const { display } = useSearch({ from: "/_authenticated/_sidebar/" })

  if (projects.length === 0) {
    return <StartProject />
  }

  return (
    <section className="space-y-8" aria-label="Projects">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StepMarker
          step="Workspace"
          title="Your projects"
          description="Pick up where you left off."
        />

        <Button
          asChild
          className="rounded-xl font-bold cursor-pointer hover:scale-105 transition-transform duration-200"
        >
          <Link to="/create">
            <IconCirclePlusFilled className="size-5" />
            Create project
          </Link>
        </Button>
      </div>

      {/* <Separator /> */}

      <div
        className={cn("grid gap-6 grid-cols-1", {
          "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4": display === "grid",
        })}
      >
        {projects.map((project) => (
          <Link
            to="/projects/$projectId/editor"
            params={{ projectId: project.id }}
            key={project.id}
            className="block"
            preload={false}
          >
            <ProjectCard {...project} display={display} />
          </Link>
        ))}
      </div>
    </section>
  )
}

export const ListProjectsSkeleton = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-60" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <Separator />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-70 w-full" />
        ))}
      </div>
    </div>
  )
}

export const ListProjectsError = ({
  msg = "Something went wrong",
  reset,
}: {
  msg?: string
  reset?: () => void
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-500 p-4">
      <h3>{msg}</h3>
      <button className="cursor-pointer" onClick={reset}>
        Retry
      </button>
    </div>
  )
}
