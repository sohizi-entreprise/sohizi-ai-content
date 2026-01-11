import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProjects, deleteProject } from '@/lib/server/projects'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Film, MoreVertical, Trash2, FileEdit, Layout } from 'lucide-react'
import { toast } from 'sonner'

const projectsQueryOptions = {
  queryKey: ['projects'],
  queryFn: () => getProjects(),
}

export const Route = createFileRoute('/projects/')({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(projectsQueryOptions)
  },
  component: ProjectsPage,
})

const FORMAT_LABELS: Record<string, string> = {
  storytime: 'Story Time',
  explainer: 'Explainer',
  documentary: 'Documentary',
  presenter: 'Presenter',
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  OUTLINE_GENERATED: 'secondary',
  OUTLINE_CONFIRMED: 'secondary',
  SHOTS_GENERATED: 'default',
}

function ProjectsPage() {
  const queryClient = useQueryClient()
  const { data: projects } = useSuspenseQuery(projectsQueryOptions)

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => deleteProject({ data: { projectId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: () => {
      toast.error('Failed to delete project')
    },
  })

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">
              Sohizi
            </span>
          </div>
          <Link to="/projects/new">
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight">Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Create and manage your video storyboards
          </p>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Film className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Get started by creating your first video storyboard
              </p>
              <Link to="/projects/new">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="group relative transition-all hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/5"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="line-clamp-1">{project.name}</CardTitle>
                      <CardDescription>
                        {FORMAT_LABELS[project.format] || project.format}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => deleteMutation.mutate(project.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-center gap-2">
                    <Badge variant={STATUS_COLORS[project.status]}>
                      {project.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {(project.status === 'DRAFT' ||
                      project.status === 'OUTLINE_GENERATED') && (
                      <Link
                        to="/projects/$projectId/outline"
                        params={{ projectId: project.id }}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2" size="sm">
                          <FileEdit className="h-4 w-4" />
                          {project.status === 'DRAFT' ? 'Start' : 'Edit Outline'}
                        </Button>
                      </Link>
                    )}
                    {(project.status === 'OUTLINE_CONFIRMED' ||
                      project.status === 'SHOTS_GENERATED') && (
                      <Link
                        to="/projects/$projectId/storyboard"
                        params={{ projectId: project.id }}
                        className="flex-1"
                      >
                        <Button variant="outline" className="w-full gap-2" size="sm">
                          <Layout className="h-4 w-4" />
                          Storyboard
                        </Button>
                      </Link>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Created {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

