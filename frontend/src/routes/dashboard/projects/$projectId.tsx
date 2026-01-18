import DashboardHeader from '@/components/layout/dashboard-header'
import { ThemeToggle } from '@/components/theme-toggle'
import { Skeleton } from '@/components/ui/skeleton'
import { UserMenu } from '@/components/user-menu'
import { getProjectQueryOptions } from '@/features/projects/query-mutation'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, Outlet, useParams } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Suspense } from 'react'
import ProjectNav from '@/components/layout/project-nav'

export const Route = createFileRoute('/dashboard/projects/$projectId')({
  component: RouteComponent,
  beforeLoad: async({params, context}) => {
      await context.queryClient.ensureQueryData(getProjectQueryOptions(params.projectId))
  },
  notFoundComponent: () => <div>Project not found</div>,
  
  errorComponent: ({error}) => <div className='text-red-500'>Error loading project: {error.message}</div>,
})

function RouteComponent() {
  const { projectId } = useParams({ from: '/dashboard/projects/$projectId' })
  return (
    <div className='h-screen'>
        <DashboardHeader leftSide={
                                    <Suspense fallback={<Skeleton className="h-4 w-16" />}>
                                        <LeftSideHeader projectId={projectId} />
                                    </Suspense>
                                } 
                         rightSide={<RightSideHeader />

        } 
        />
        <div className='flex gap-4 h-full'>
            <div className='flex items-center justify-center gap-4 px-4'>
                <ProjectNav />

            </div>

            <div className='flex-1 overflow-y-auto pt-header px-4'>
                <div className='container mx-auto pt-8'>
                    <Outlet />
                </div>
            </div>

        </div>
    </div>
  )
}

function LeftSideHeader({projectId}: {projectId: string}){
    const {data: project} = useSuspenseQuery(getProjectQueryOptions(projectId))
    return (
        <nav className="flex items-center gap-1 text-sm">
            <Link 
                to="/dashboard/projects" 
                className="text-muted-foreground transition-colors hover:text-white"
            >
                Projects
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <span className="font-medium text-white">{project.name}</span>
        </nav>
    )
}

function RightSideHeader(){
    return (
        <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
        </div>
    )
}
