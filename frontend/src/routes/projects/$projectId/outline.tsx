import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getProject, updateOutline } from '@/lib/server/projects'
import { generateOutline, generateShots } from '@/lib/server/ai'
import { AUDIENCES, TIMES_OF_DAY, type UpdateOutlineInput } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft,
  Film,
  Sparkles,
  Save,
  Play,
  GripVertical,
  Clock,
  MapPin,
} from 'lucide-react'
import { toast } from 'sonner'

const projectQueryOptions = (projectId: string) => ({
  queryKey: ['project', projectId],
  queryFn: () => getProject({ data: { projectId } }),
})

export const Route = createFileRoute('/projects/$projectId/outline')({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId))
  },
  component: OutlineEditorPage,
  pendingComponent: OutlineEditorSkeleton,
})

function OutlineEditorSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="ml-4 h-6 w-48" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="space-y-8">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </main>
    </div>
  )
}

function OutlineEditorPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId))

  // Form state
  const [brief, setBrief] = useState<UpdateOutlineInput['projectBrief']>(undefined)
  const [scenes, setScenes] = useState<UpdateOutlineInput['scenes']>([])
  const [sourceStory, setSourceStory] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Initialize form from project data
  useEffect(() => {
    if (project) {
      if (project.brief) {
        setBrief({
          title: project.brief.title,
          logline: project.brief.logline,
          audience: project.brief.audience,
          tone: project.brief.tone,
          genre: project.brief.genre,
          stylePackId: null,
          constraints: project.brief.constraints,
        })
      }
      if (project.scenes) {
        setScenes(
          project.scenes.map((s) => ({
            sceneId: s.sceneId,
            actId: s.actId,
            order: s.order,
            title: s.title,
            summary: s.summary,
            locationHint: s.locationRef,
            timeOfDay: s.timeOfDay,
            mood: s.mood,
          }))
        )
      }
    }
  }, [project])

  // Generate outline mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true)
      await generateOutline({
        data: {
          projectId,
          sourceStory,
          tone: brief?.tone,
          genre: brief?.genre,
          targetLengthSec: null,
          stylePackId: null,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Outline generated!')
      setIsGenerating(false)
    },
    onError: () => {
      toast.error('Failed to generate outline')
      setIsGenerating(false)
    },
  })

  // Save outline mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      updateOutline({
        data: {
          projectId,
          projectBrief: brief,
          scenes,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Outline saved!')
    },
    onError: () => {
      toast.error('Failed to save outline')
    },
  })

  // Generate shots mutation
  const generateShotsMutation = useMutation({
    mutationFn: async () => {
      // First save the outline
      await updateOutline({
        data: {
          projectId,
          projectBrief: brief,
          scenes,
        },
      })
      // Then generate shots
      await generateShots({
        data: {
          projectId,
          scope: 'all',
          sceneId: null,
        },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      toast.success('Shots generated!')
      navigate({
        to: '/projects/$projectId/storyboard',
        params: { projectId },
      })
    },
    onError: () => {
      toast.error('Failed to generate shots')
    },
  })

  const updateScene = (
    index: number,
    field: keyof NonNullable<UpdateOutlineInput['scenes']>[0],
    value: string | number | null
  ) => {
    setScenes((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  const hasOutline = project.status !== 'DRAFT' && brief

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center">
            <Link to="/projects">
              <Button variant="ghost" size="icon-sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="ml-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500">
                <Film className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-lg font-semibold">{project.name}</h1>
                <p className="text-xs text-muted-foreground">Outline Editor</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasOutline}
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              onClick={() => generateShotsMutation.mutate()}
              disabled={generateShotsMutation.isPending || !hasOutline}
            >
              {generateShotsMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Generate Shots
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr,400px]">
          {/* Left Column - Brief & Scenes */}
          <div className="space-y-6">
            {/* Generate Section (if no outline) */}
            {!hasOutline && (
              <Card className="border-dashed border-violet-500/30 bg-violet-500/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500" />
                    Generate Outline
                  </CardTitle>
                  <CardDescription>
                    Enter your story or concept to generate an AI-powered outline
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Enter your story, script, or concept..."
                    value={sourceStory}
                    onChange={(e) => setSourceStory(e.target.value)}
                    className="min-h-[150px]"
                  />
                  <Button
                    onClick={() => generateMutation.mutate()}
                    disabled={isGenerating || !sourceStory.trim()}
                    className="w-full gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Outline
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Brief Section */}
            {hasOutline && brief && (
              <Card>
                <CardHeader>
                  <CardTitle>Project Brief</CardTitle>
                  <CardDescription>
                    Core details about your video project
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={brief.title}
                      onChange={(e) =>
                        setBrief((prev) => ({ ...prev!, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Logline</Label>
                    <Textarea
                      value={brief.logline}
                      onChange={(e) =>
                        setBrief((prev) => ({ ...prev!, logline: e.target.value }))
                      }
                      className="min-h-[80px]"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Audience</Label>
                      <Select
                        value={brief.audience}
                        onValueChange={(v) =>
                          setBrief((prev) => ({
                            ...prev!,
                            audience: v as typeof brief.audience,
                          }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIENCES.map((a) => (
                            <SelectItem key={a} value={a}>
                              {a.charAt(0).toUpperCase() + a.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tone</Label>
                      <Input
                        value={brief.tone || ''}
                        onChange={(e) =>
                          setBrief((prev) => ({ ...prev!, tone: e.target.value }))
                        }
                        placeholder="e.g., inspirational"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Genre</Label>
                      <Input
                        value={brief.genre || ''}
                        onChange={(e) =>
                          setBrief((prev) => ({ ...prev!, genre: e.target.value }))
                        }
                        placeholder="e.g., narrative"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scenes Section */}
            {hasOutline && scenes && scenes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Scenes</CardTitle>
                  <CardDescription>
                    Edit and arrange the scenes in your storyboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-2">
                    {scenes.map((scene, index) => (
                      <AccordionItem
                        key={scene.sceneId}
                        value={scene.sceneId}
                        className="rounded-lg border bg-card px-4"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline" className="font-mono text-xs">
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{scene.title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-4">
                          <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                              value={scene.title}
                              onChange={(e) =>
                                updateScene(index, 'title', e.target.value)
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Summary</Label>
                            <Textarea
                              value={scene.summary}
                              onChange={(e) =>
                                updateScene(index, 'summary', e.target.value)
                              }
                              className="min-h-[80px]"
                            />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                Location
                              </Label>
                              <Input
                                value={scene.locationHint || ''}
                                onChange={(e) =>
                                  updateScene(index, 'locationHint', e.target.value)
                                }
                                placeholder="e.g., Forest clearing"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Time of Day
                              </Label>
                              <Select
                                value={scene.timeOfDay}
                                onValueChange={(v) =>
                                  updateScene(
                                    index,
                                    'timeOfDay',
                                    v as typeof scene.timeOfDay
                                  )
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIMES_OF_DAY.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Mood</Label>
                              <Input
                                value={scene.mood || ''}
                                onChange={(e) =>
                                  updateScene(index, 'mood', e.target.value)
                                }
                                placeholder="e.g., mysterious"
                              />
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Preview / Info */}
          <div className="space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Project Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={
                      project.status === 'SHOTS_GENERATED' ? 'default' : 'secondary'
                    }
                  >
                    {project.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Format</span>
                  <span className="text-sm font-medium capitalize">
                    {project.format}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scenes</span>
                  <span className="text-sm font-medium">{scenes?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Created</span>
                  <span className="text-sm font-medium">
                    {new Date(project.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            {hasOutline && (
              <Card>
                <CardHeader>
                  <CardTitle>Next Steps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>1. Review and edit the project brief above</p>
                  <p>2. Adjust scene details as needed</p>
                  <p>3. Click "Generate Shots" to create your storyboard</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

