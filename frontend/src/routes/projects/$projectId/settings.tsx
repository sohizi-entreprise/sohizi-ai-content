import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProject, deleteProject } from '@/lib/server/projects'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { StoryboardSidebar } from '@/components/storyboard-sidebar'
import { UserMenu } from '@/components/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Settings,
  Film,
  Calendar,
  Clock,
  Trash2,
  FileText,
  Target,
  Users,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

const projectQueryOptions = (projectId: string) => ({
  queryKey: ['project', projectId],
  queryFn: () => getProject({ data: { projectId } }),
})

export const Route = createFileRoute('/projects/$projectId/settings')({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId))
  },
  component: SettingsPage,
  pendingComponent: SettingsSkeleton,
})

function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Skeleton header */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between pl-[5.5rem] pr-6">
          <div className="flex items-center gap-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
      </header>

      <div className="fixed left-4 top-1/2 z-40 -translate-y-1/2 rounded-[20px] bg-black/40 p-2 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-11 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="pl-[4.5rem] pt-14">
        <main className="mx-auto max-w-3xl px-6 py-8">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  OUTLINE_GENERATED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  OUTLINE_CONFIRMED: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  SHOTS_GENERATED: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const formatLabels: Record<string, string> = {
  storytime: 'Story Time',
  explainer: 'Explainer',
  documentary: 'Documentary',
  presenter: 'Presenter',
}

function SettingsPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId))

  const deleteProjectMutation = useMutation({
    mutationFn: () => deleteProject({ data: { projectId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      navigate({ to: '/projects' })
    },
    onError: () => {
      toast.error('Failed to delete project')
    },
  })

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center pl-[4.5rem]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header - spans full width, on top of sidebar */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between pl-[5.5rem] pr-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm">
            <Link 
              to="/projects" 
              className="text-muted-foreground transition-colors hover:text-white"
            >
              Projects
            </Link>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <span className="font-medium text-white">{project.name}</span>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <StoryboardSidebar activeNav="settings" />

      {/* Main content wrapper - offset for header and sidebar */}
      <div className="pl-[4.5rem] pt-14">
        {/* Main Content */}
        <main className="mx-auto max-w-3xl px-6 py-8">
          {/* Page Title */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-zinc-600">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Project Settings</h1>
              <p className="text-sm text-muted-foreground">
                Manage your project configuration
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Film className="h-5 w-5 text-violet-400" />
                  Project Information
                </CardTitle>
                <CardDescription>
                  Basic information about your project
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Project Name</p>
                    <p className="font-medium">{project.name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Format</p>
                    <Badge variant="outline">
                      {formatLabels[project.format] || project.format}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge 
                      variant="outline"
                      className={statusColors[project.status]}
                    >
                      {project.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Scenes</p>
                    <p className="font-medium">{project.scenes?.length || 0} scenes</p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Created: {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      Updated: {new Date(project.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Brief Info */}
            {project.brief && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-amber-400" />
                    Project Brief
                  </CardTitle>
                  <CardDescription>
                    Story details and creative direction
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Title</p>
                    <p className="text-lg font-medium">{project.brief.title}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Logline</p>
                    <p className="text-foreground">{project.brief.logline}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        Audience
                      </p>
                      <Badge variant="secondary" className="capitalize">
                        {project.brief.audience}
                      </Badge>
                    </div>
                    {project.brief.tone && (
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Tone</p>
                        <Badge variant="outline">{project.brief.tone}</Badge>
                      </div>
                    )}
                    {project.brief.genre && (
                      <div className="space-y-1">
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Target className="h-3 w-3" />
                          Genre
                        </p>
                        <Badge variant="outline">{project.brief.genre}</Badge>
                      </div>
                    )}
                  </div>

                  {project.brief.constraints && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Constraints</p>
                        {project.brief.constraints.must_include?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Must Include</p>
                            <div className="flex flex-wrap gap-1">
                              {project.brief.constraints.must_include.map((item, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {project.brief.constraints.must_avoid?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Must Avoid</p>
                            <div className="flex flex-wrap gap-1">
                              {project.brief.constraints.must_avoid.map((item, idx) => (
                                <Badge
                                  key={idx}
                                  variant="outline"
                                  className="border-red-500/20 text-xs text-red-400"
                                >
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Danger Zone */}
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <Trash2 className="h-5 w-5" />
                  Danger Zone
                </CardTitle>
                <CardDescription>
                  Irreversible actions for this project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                  <div>
                    <p className="font-medium">Delete Project</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this project and all its data
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{project.name}" and all associated
                          data including scenes, shots, and generated images. This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteProjectMutation.mutate()}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete Project'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}

