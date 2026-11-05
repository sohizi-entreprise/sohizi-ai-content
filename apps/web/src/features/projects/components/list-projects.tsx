import { useSuspenseInfiniteQuery } from "@tanstack/react-query"
import { Link, useSearch } from "@tanstack/react-router"
import { Skeleton } from "@sohizi/ui/skeleton"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@sohizi/ui/empty"
import { getListProjectsQueryOptions } from "../query-mutation"
import CreateProject from "./create-project"
import ProjectCard from "./project-card"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth-client"

export default function ListProjects() {
  const { data: session } = useSession()
  const organizationId = session?.session.activeOrganizationId ?? undefined

  if (!organizationId) {
    return <ListProjectEmpty />
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
    return <ListProjectEmpty />
  }

  return (
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
  )
}

export const ListProjectsSkeleton = () => {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-70 w-full" />
      ))}
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

function ListProjectEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>No projects found</EmptyTitle>
        <EmptyDescription>Create a new project to get started</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <CreateProject />
      </EmptyContent>
    </Empty>
  )
}
