import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getProject, getStoryboard } from '@/lib/server/projects'
import { generateImages } from '@/lib/server/ai'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { GlowingEffect } from '@/components/ui/glowing-effect'
import { Spotlight } from '@/components/ui/spotlight'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { StoryboardSidebar } from '@/components/storyboard-sidebar'
import { UserMenu } from '@/components/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Image as ImageIcon,
  Camera,
  User,
  MapPin,
  Sparkles,
  Copy,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  LayoutGrid,
  Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ShotWithImage, StoryboardScene, ProjectEntities } from '@/lib/types'

const projectQueryOptions = (projectId: string) => ({
  queryKey: ['project', projectId],
  queryFn: () => getProject({ data: { projectId } }),
})

const storyboardQueryOptions = (projectId: string) => ({
  queryKey: ['storyboard', projectId],
  queryFn: () => getStoryboard({ data: { projectId } }),
})

export const Route = createFileRoute('/dashboard/projects/$projectId/storyboard')({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId))
    context.queryClient.ensureQueryData(storyboardQueryOptions(params.projectId))
  },
  component: StoryboardPage,
  pendingComponent: StoryboardSkeleton,
})

function StoryboardSkeleton() {
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

      {/* Skeleton floating sidebar */}
      <div className="fixed left-4 top-1/2 z-40 -translate-y-1/2 rounded-[20px] bg-black/40 p-2 backdrop-blur-xl">
        <div className="flex flex-col items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-11 rounded-xl" />
          ))}
        </div>
      </div>
      
      <div className="pl-[4.5rem] pt-14">
        <main className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

function StoryboardPage() {
  const { projectId } = Route.useParams()
  const queryClient = useQueryClient()
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId))
  const { data: storyboard } = useSuspenseQuery(storyboardQueryOptions(projectId))

  const [selectedShot, setSelectedShot] = useState<ShotWithImage | null>(null)
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set())
  const [activeScene, setActiveScene] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'by-scene' | 'all-shots'>('by-scene')

  // Set initial active scene
  if (!activeScene && storyboard?.scenes?.length) {
    setActiveScene(storyboard.scenes[0].sceneId)
  }

  // Generate images mutation
  const generateImagesMutation = useMutation({
    mutationFn: (shotIds: string[]) =>
      generateImages({
        data: {
          projectId,
          shotIds,
          quality: 'draft',
          model: null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storyboard', projectId] })
      toast.success('Images generated!')
      setSelectedShotIds(new Set())
    },
    onError: () => {
      toast.error('Failed to generate images')
    },
  })

  const toggleShotSelection = (shotId: string) => {
    setSelectedShotIds((prev) => {
      const next = new Set(prev)
      if (next.has(shotId)) {
        next.delete(shotId)
      } else {
        next.add(shotId)
      }
      return next
    })
  }

  const selectAllInScene = (scene: StoryboardScene) => {
    const sceneShots = scene.shots.map((s) => s.id)
    setSelectedShotIds((prev) => {
      const next = new Set(prev)
      const allSelected = sceneShots.every((id) => next.has(id))
      if (allSelected) {
        sceneShots.forEach((id) => next.delete(id))
      } else {
        sceneShots.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const generateSelected = () => {
    if (selectedShotIds.size === 0) {
      toast.error('Select shots to generate images')
      return
    }
    generateImagesMutation.mutate(Array.from(selectedShotIds))
  }

  const generateAll = () => {
    if (!storyboard?.scenes) return
    const allShotIds = storyboard.scenes.flatMap((s) => s.shots.map((shot) => shot.id))
    generateImagesMutation.mutate(allShotIds)
  }

  if (!project || !storyboard) {
    return (
      <div className="flex min-h-screen items-center justify-center pl-[4.5rem]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  const currentScene = storyboard.scenes?.find((s) => s.sceneId === activeScene)

  // Flatten all shots with scene info for "All Shots" view
  const allShots = storyboard.scenes?.flatMap((scene) =>
    scene.shots.map((shot) => ({
      ...shot,
      sceneOrder: scene.order,
      sceneTitle: scene.title,
      sceneId: scene.sceneId,
    }))
  ) || []

  const selectAllShots = () => {
    if (!storyboard?.scenes) return
    const allShotIds = storyboard.scenes.flatMap((s) => s.shots.map((shot) => shot.id))
    setSelectedShotIds((prev) => {
      const allSelected = allShotIds.every((id) => prev.has(id))
      if (allSelected) {
        return new Set()
      }
      return new Set(allShotIds)
    })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/20">
      {/* Spotlight Effect */}
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60 fixed"
        fill="rgba(139, 92, 246, 0.35)"
      />

      {/* Header - spans full width, on top of sidebar */}
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.08] bg-black/60 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-4">
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

      {/* Left Navigation Sidebar */}
      <StoryboardSidebar activeNav="storyboard" />

      {/* Main content wrapper - offset for header and sidebar */}
      <div className="pl-[4.5rem] pt-14">
        {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Page Title & View Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold">Storyboard</h1>
            <p className="text-sm text-muted-foreground">
              {storyboard.scenes?.length || 0} scene{(storyboard.scenes?.length || 0) !== 1 ? 's' : ''} • Visual planning
            </p>
          </div>

          {/* View Mode Toggle */}
          {storyboard.scenes && storyboard.scenes.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/20 p-1">
              <button
                onClick={() => setViewMode('by-scene')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  viewMode === 'by-scene'
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                <Layers className="h-4 w-4" />
                By Scene
              </button>
              <button
                onClick={() => setViewMode('all-shots')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  viewMode === 'all-shots'
                    ? 'bg-violet-500/20 text-violet-400'
                    : 'text-muted-foreground hover:text-white'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                All Shots
              </button>
            </div>
          )}
        </div>

        {storyboard.scenes && storyboard.scenes.length > 0 ? (
          <div className="space-y-6">

            {/* By Scene View */}
            {viewMode === 'by-scene' && (
              <Tabs
                value={activeScene || storyboard.scenes[0].sceneId}
                onValueChange={setActiveScene}
              >
                <TabsList className="mb-6 h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
                  {storyboard.scenes.map((scene, index) => (
                    <TabsTrigger
                      key={scene.sceneId}
                      value={scene.sceneId}
                      className="data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-500"
                    >
                      <span className="mr-1.5 font-mono text-xs opacity-60">
                        {index + 1}
                      </span>
                      {scene.title}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {storyboard.scenes.map((scene) => (
                  <TabsContent key={scene.sceneId} value={scene.sceneId}>
                    {/* Scene Info */}
                    <Card className="mb-6">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle>{scene.title}</CardTitle>
                            <CardDescription className="mt-1">
                              {scene.summary}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            {scene.mood && (
                              <Badge variant="outline">{scene.mood}</Badge>
                            )}
                            {scene.timeOfDay && scene.timeOfDay !== 'unspecified' && (
                              <Badge variant="secondary">{scene.timeOfDay}</Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </Card>

                    {/* Shots Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {scene.shots.map((shot) => (
                        <ShotCard
                          key={shot.id}
                          shot={shot}
                          sceneOrder={scene.order}
                          entities={storyboard.entities}
                          isSelected={selectedShotIds.has(shot.id)}
                          onSelect={() => toggleShotSelection(shot.id)}
                          onInspect={() => setSelectedShot(shot)}
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}

            {/* All Shots View */}
            {viewMode === 'all-shots' && (
              <div className="space-y-8">
                {storyboard.scenes.map((scene, sceneIndex) => (
                  <div key={scene.sceneId}>
                    {/* Scene Header */}
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 font-mono text-sm font-semibold text-violet-400">
                        {sceneIndex + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{scene.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''}
                          {scene.mood && ` • ${scene.mood}`}
                        </p>
                      </div>
                    </div>

                    {/* Shots Grid */}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {scene.shots.map((shot) => (
                        <ShotCard
                          key={shot.id}
                          shot={shot}
                          sceneOrder={scene.order}
                          entities={storyboard.entities}
                          isSelected={selectedShotIds.has(shot.id)}
                          onSelect={() => toggleShotSelection(shot.id)}
                          onInspect={() => setSelectedShot(shot)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No shots generated yet</h3>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Go back to the outline editor to generate shots
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
      </main>

      {/* Floating Action Bar */}
      {storyboard.scenes && storyboard.scenes.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/80 px-4 py-2 shadow-2xl backdrop-blur-xl">
            {selectedShotIds.size > 0 && (
              <Badge variant="secondary" className="rounded-full">
                {selectedShotIds.size} selected
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={generateSelected}
              disabled={selectedShotIds.size === 0 || generateImagesMutation.isPending}
              className="rounded-full"
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Generate Selected
            </Button>
            <div className="h-4 w-px bg-white/20" />
            <Button
              size="sm"
              className="gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
              onClick={generateAll}
              disabled={generateImagesMutation.isPending}
            >
              {generateImagesMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate All
                </>
              )}
            </Button>
          </div>
        </div>
      )}
      </div>

      {/* Shot Inspector Sheet */}
      <Sheet open={!!selectedShot} onOpenChange={() => setSelectedShot(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          {selectedShot && (
            <ShotInspector
              shot={selectedShot}
              entities={storyboard.entities}
              onRegenerate={() => {
                generateImagesMutation.mutate([selectedShot.id])
              }}
              isRegenerating={generateImagesMutation.isPending}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// Shot Card Component
function ShotCard({
  shot,
  sceneOrder,
  entities,
  isSelected,
  onSelect,
  onInspect,
}: {
  shot: ShotWithImage
  sceneOrder: number
  entities: ProjectEntities
  isSelected: boolean
  onSelect: () => void
  onInspect: () => void
}) {
  const characterNames = shot.entitiesInShot?.character_ids
    ?.map((id) => entities.characters.find((c) => c.characterId === id)?.name)
    .filter(Boolean) || []

  const locationName = entities.locations.find(
    (l) => l.locationId === shot.entitiesInShot?.location_id
  )?.name

  return (
    <div className="group relative rounded-xl">
      <GlowingEffect
        blur={0}
        borderWidth={2}
        spread={60}
        glow={true}
        disabled={false}
        proximity={48}
        inactiveZone={0.1}
      />
      <Card
        className={`relative cursor-pointer overflow-hidden transition-all h-full ${
          isSelected ? 'border-violet-500 ring-2 ring-violet-500/20' : ''
        }`}
      >
        {/* Selection Checkbox */}
        <div className="absolute left-3 top-3 z-10">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="border-white/50 bg-black/30 data-[state=checked]:bg-violet-500 data-[state=checked]:text-white"
          />
        </div>

        {/* Image or Placeholder */}
        <div
          className="relative aspect-video cursor-pointer bg-muted"
          onClick={onInspect}
        >
          {shot.image ? (
            <img
              src={shot.image.imageUrl}
              alt={shot.visualSummary}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}

          {/* Shot Type Badge */}
          <div className="absolute bottom-2 left-2 flex gap-1">
            <Badge
              variant="secondary"
              className="bg-black/60 text-white backdrop-blur-sm"
            >
              {shot.shotType}
            </Badge>
            <Badge
              variant="secondary"
              className="bg-black/60 text-white backdrop-blur-sm"
            >
              {shot.angle.replace('_', ' ')}
            </Badge>
          </div>

          {/* Shot Number */}
          <div className="absolute right-2 top-2">
            <Badge className="bg-black/60 font-mono text-white backdrop-blur-sm">
              {sceneOrder + 1}.{shot.order + 1}
            </Badge>
          </div>
        </div>

        {/* Shot Info */}
        <CardContent className="p-3" onClick={onInspect}>
          <p className="line-clamp-2 text-sm">{shot.visualSummary}</p>

          {/* Entity Chips */}
          <div className="mt-2 flex flex-wrap gap-1">
            {characterNames.slice(0, 2).map((name) => (
              <Badge key={name} variant="outline" className="text-xs">
                <User className="mr-1 h-3 w-3" />
                {name}
              </Badge>
            ))}
            {locationName && (
              <Badge variant="outline" className="text-xs">
                <MapPin className="mr-1 h-3 w-3" />
                {locationName}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Shot Inspector Component
function ShotInspector({
  shot,
  entities,
  onRegenerate,
  isRegenerating,
}: {
  shot: ShotWithImage
  entities: ProjectEntities
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const characterNames = shot.entitiesInShot?.character_ids
    ?.map((id) => entities.characters.find((c) => c.characterId === id))
    .filter(Boolean) || []

  const location = entities.locations.find(
    (l) => l.locationId === shot.entitiesInShot?.location_id
  )

  const copyPrompt = () => {
    if (shot.image?.prompt) {
      navigator.clipboard.writeText(shot.image.prompt)
      toast.success('Prompt copied to clipboard')
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Shot {shot.order + 1}</SheetTitle>
        <SheetDescription>{shot.visualSummary}</SheetDescription>
      </SheetHeader>
      <ScrollArea className="mt-6 h-[calc(100vh-12rem)]">
        <div className="space-y-6 pr-4">
          {/* Image */}
          <div className="overflow-hidden rounded-lg bg-muted">
            {shot.image ? (
              <img
                src={shot.image.imageUrl}
                alt={shot.visualSummary}
                className="aspect-video w-full object-cover"
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onRegenerate}
              disabled={isRegenerating}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isRegenerating ? 'animate-spin' : ''}`}
              />
              Regenerate
            </Button>
            {shot.image?.prompt && (
              <Button variant="outline" onClick={copyPrompt}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Prompt
              </Button>
            )}
          </div>

          {/* Camera Specs */}
          <div className="space-y-3">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4" />
              Camera
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Type</div>
                <div className="mt-1 font-medium capitalize">{shot.shotType}</div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Angle</div>
                <div className="mt-1 font-medium capitalize">
                  {shot.angle.replace('_', ' ')}
                </div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Lens</div>
                <div className="mt-1 font-medium">{shot.lens || '35mm'}</div>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="text-xs text-muted-foreground">Movement</div>
                <div className="mt-1 font-medium capitalize">
                  {shot.movement.replace(/_/g, ' ')}
                </div>
              </div>
            </div>
          </div>

          {/* Characters */}
          {characterNames.length > 0 && (
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                Characters
              </h4>
              <div className="space-y-2">
                {characterNames.map((char) => (
                  <div
                    key={char.characterId}
                    className="rounded-lg border bg-muted/50 p-3"
                  >
                    <div className="font-medium">{char.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {char.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {location && (
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                Location
              </h4>
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="font-medium">{location.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {location.description}
                </div>
                {location.lighting && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Lighting: {location.lighting}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dialogue/Narration */}
          {shot.spoken && shot.spoken.length > 0 && (
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <MessageSquare className="h-4 w-4" />
                Dialogue / Narration
              </h4>
              <div className="space-y-2">
                {shot.spoken.map((utterance) => (
                  <div
                    key={utterance.utterance_id}
                    className="rounded-lg border bg-muted/50 p-3"
                  >
                    <div className="text-xs text-muted-foreground uppercase">
                      {utterance.kind}
                    </div>
                    <div className="mt-1 italic">"{utterance.text}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action & Composition */}
          {(shot.action || shot.composition) && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Details</h4>
              {shot.action && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Action</div>
                  <div className="mt-1">{shot.action}</div>
                </div>
              )}
              {shot.composition && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="text-xs text-muted-foreground">Composition</div>
                  <div className="mt-1">{shot.composition}</div>
                </div>
              )}
            </div>
          )}

          {/* Mood Keywords */}
          {shot.moodKeywords && shot.moodKeywords.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Mood</h4>
              <div className="flex flex-wrap gap-2">
                {shot.moodKeywords.map((keyword, i) => (
                  <Badge key={i} variant="secondary">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </>
  )
}

