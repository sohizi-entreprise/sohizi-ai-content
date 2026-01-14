import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getProject, getStoryboard } from '@/lib/server/projects'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { StoryboardSidebar } from '@/components/storyboard-sidebar'
import { UserMenu } from '@/components/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { MessageSquare, User, Mic, ChevronRight } from 'lucide-react'

const projectQueryOptions = (projectId: string) => ({
  queryKey: ['project', projectId],
  queryFn: () => getProject({ data: { projectId } }),
})

const storyboardQueryOptions = (projectId: string) => ({
  queryKey: ['storyboard', projectId],
  queryFn: () => getStoryboard({ data: { projectId } }),
})

export const Route = createFileRoute('/dashboard/projects/$projectId/script')({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId))
    context.queryClient.ensureQueryData(storyboardQueryOptions(params.projectId))
  },
  component: ScriptPage,
  pendingComponent: ScriptSkeleton,
})

function ScriptSkeleton() {
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
        <main className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

function ScriptPage() {
  const { projectId } = Route.useParams()
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId))
  const { data: storyboard } = useSuspenseQuery(storyboardQueryOptions(projectId))

  if (!project || !storyboard) {
    return (
      <div className="flex min-h-screen items-center justify-center pl-[4.5rem]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  // Collect all dialogue and narration from shots
  const scriptContent = storyboard.scenes?.map((scene) => {
    const dialogues = scene.shots.flatMap((shot) => 
      shot.spoken?.map((utterance) => ({
        ...utterance,
        shotOrder: shot.order,
        characterName: storyboard.entities.characters.find(
          (c) => c.characterId === utterance.speaker_id
        )?.name || 'Unknown',
      })) || []
    )
    return {
      ...scene,
      dialogues,
    }
  }) || []

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

      <StoryboardSidebar activeNav="script" />

      {/* Main content wrapper - offset for header and sidebar */}
      <div className="pl-[4.5rem] pt-14">
        {/* Main Content */}
        <main className="mx-auto max-w-4xl px-6 py-8">
          {/* Page Title */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Full Script</h1>
              <p className="text-sm text-muted-foreground">
                {project.brief?.title || 'Dialogue and narration'}
              </p>
            </div>
          </div>

          {project.brief && (
            <Card className="mb-8 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5">
              <CardHeader>
                <CardTitle className="text-xl">{project.brief.title}</CardTitle>
                <p className="text-muted-foreground">{project.brief.logline}</p>
              </CardHeader>
            </Card>
          )}

          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-8 pr-4">
              {scriptContent.length > 0 ? (
                scriptContent.map((scene, sceneIndex) => (
                  <Card key={scene.sceneId} className="overflow-hidden">
                    <CardHeader className="border-b bg-muted/30">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          Scene {sceneIndex + 1}
                        </Badge>
                        <CardTitle className="text-lg">{scene.title}</CardTitle>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {scene.summary}
                      </p>
                      <div className="mt-2 flex gap-2">
                        {scene.mood && (
                          <Badge variant="secondary" className="text-xs">
                            {scene.mood}
                          </Badge>
                        )}
                        {scene.timeOfDay && scene.timeOfDay !== 'unspecified' && (
                          <Badge variant="outline" className="text-xs">
                            {scene.timeOfDay}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      {scene.dialogues.length > 0 ? (
                        <div className="space-y-4">
                          {scene.dialogues.map((dialogue, idx) => (
                            <div
                              key={dialogue.utterance_id || idx}
                              className={`rounded-lg p-4 ${
                                dialogue.kind === 'narration'
                                  ? 'border-l-2 border-violet-500/50 bg-violet-500/5 italic'
                                  : 'border border-border bg-muted/30'
                              }`}
                            >
                              <div className="mb-2 flex items-center gap-2">
                                {dialogue.kind === 'narration' ? (
                                  <>
                                    <Mic className="h-4 w-4 text-violet-400" />
                                    <span className="text-sm font-medium text-violet-400">
                                      Narrator
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <User className="h-4 w-4 text-amber-400" />
                                    <span className="text-sm font-medium text-amber-400">
                                      {dialogue.characterName}
                                    </span>
                                  </>
                                )}
                              </div>
                              <p className="text-foreground">"{dialogue.text}"</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground">
                          No dialogue in this scene
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium">No script content yet</h3>
                    <p className="mb-6 text-center text-sm text-muted-foreground">
                      Generate shots to see the full script with dialogue and narration
                    </p>
                    <Link
                      to="/projects/$projectId/outline"
                      params={{ projectId: project.id }}
                    >
                      <Button>Go to Outline Editor</Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  )
}

