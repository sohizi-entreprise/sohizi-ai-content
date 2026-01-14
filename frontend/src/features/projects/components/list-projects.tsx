import { useMutation, useSuspenseQuery } from '@tanstack/react-query'
import ProjectCard from './project-card'
import { deleteProjectMutationOptions, listProjectsQueryOptions } from '../query-mutation'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'


const fakeProject = {
    id: '088f93d8-91cb-429b-8091-9385467679c9',
    name: 'Project 1',
    format: 'storytime',
    createdAt: '2021-01-01',
    updatedAt: '2021-01-01',
    audience: 'general',
    tone: 'tone',
    genre: 'mystery',
    language: 'language'
} as const


export default function ListProjects() {
    const { data: projects = [] } = useSuspenseQuery(listProjectsQueryOptions)
    const { mutate: deleteProject } = useMutation(deleteProjectMutationOptions)
    if (projects.length === 0) {
        return <ListProjectEmpty />
    }
  return (
    <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
      {[...projects, fakeProject].map((project) => (
        <Link to="/dashboard/projects/$projectId/script" params={{ projectId: project.id }} key={project.id} className='block'>
            <ProjectCard key={project.id} 
                        id={project.id}
                        name={project.name}
                        format={project.format}
                        createdAt={project.createdAt}
                        onDelete={() => deleteProject(project.id)}
            />
        </Link>
      ))}
    </div>
  )
}

export const ListProjectsSkeleton = () => {
    return (
        <div className='grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className='h-48 w-full' />
            ))}
        </div>
    )
}

export const ListProjectsError = ({msg = 'Something went wrong', reset}: {msg?: string; reset?: () => void}) => {
    return (
        <div className='flex flex-col items-center justify-center gap-4 rounded-lg border border-red-500 p-4'>
            <h3>{msg}</h3>
            <button className='cursor-pointer' onClick={reset}>Retry</button>
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
