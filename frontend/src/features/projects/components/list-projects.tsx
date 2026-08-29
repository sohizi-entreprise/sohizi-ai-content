import { useMutation, useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { Link, useSearch } from '@tanstack/react-router'
import {
  deleteProjectMutationOptions,
  getListProjectsQueryOptions,
} from '../query-mutation'
import ProjectCard from './project-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/auth-client'

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
  const { mutate: deleteProject } = useMutation(deleteProjectMutationOptions)
  const { display } = useSearch({ from: '/dashboard/main/projects' })

  if (projects.length === 0) {
    return <ListProjectEmpty />
  }

  return (
    <div
      className={cn('grid gap-6 grid-cols-1', {
        'sm:grid-cols-2 lg:grid-cols-3': display === 'grid',
      })}
    >
      {projects.map((project) => (
        <Link
          to="/dashboard/projects/$projectId/editor"
          params={{ projectId: project.id }}
          key={project.id}
          className="block"
          preload={false}
        >
          <ProjectCard
            {...project}
            onDelete={() => deleteProject(project.id)}
            display={display}
          />
        </Link>
      ))}
    </div>
  )
}

export const ListProjectsSkeleton = () => {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-[280px] w-full" />
      ))}
    </div>
  )
}

export const ListProjectsError = ({
  msg = 'Something went wrong',
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
        <Link to="/dashboard/projects/new">
          <Button>Create Project</Button>
        </Link>
      </EmptyContent>
    </Empty>
  )
}
