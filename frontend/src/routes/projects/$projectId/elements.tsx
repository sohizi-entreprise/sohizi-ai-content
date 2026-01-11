import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getProject, getStoryboard } from '@/lib/server/projects'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StoryboardSidebar } from '@/components/storyboard-sidebar'
import { UserMenu } from '@/components/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Boxes,
  MapPin,
  Package,
  Shirt,
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Lightbulb,
  Palette,
  ChevronRight,
} from 'lucide-react'
import type { TimeOfDay } from '@/lib/types'

const projectQueryOptions = (projectId: string) => ({
  queryKey: ['project', projectId],
  queryFn: () => getProject({ data: { projectId } }),
})

const storyboardQueryOptions = (projectId: string) => ({
  queryKey: ['storyboard', projectId],
  queryFn: () => getStoryboard({ data: { projectId } }),
})

export const Route = createFileRoute('/projects/$projectId/elements')({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId))
    context.queryClient.ensureQueryData(storyboardQueryOptions(params.projectId))
  },
  component: ElementsPage,
  pendingComponent: ElementsSkeleton,
})

function ElementsSkeleton() {
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
        <main className="mx-auto max-w-6xl px-6 py-8">
          <Skeleton className="mb-6 h-10 w-96" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}

const timeOfDayIcons: Record<TimeOfDay, typeof Sun> = {
  dawn: Sunrise,
  day: Sun,
  sunset: Sunset,
  night: Moon,
  unspecified: Sun,
}

function ElementsPage() {
  const { projectId } = Route.useParams()
  const { data: project } = useSuspenseQuery(projectQueryOptions(projectId))
  const { data: storyboard } = useSuspenseQuery(storyboardQueryOptions(projectId))
  const [activeTab, setActiveTab] = useState('locations')

  if (!project || !storyboard) {
    return (
      <div className="flex min-h-screen items-center justify-center pl-[4.5rem]">
        <p className="text-muted-foreground">Project not found</p>
      </div>
    )
  }

  const { locations, props, costumes, characters } = storyboard.entities || {
    locations: [],
    props: [],
    costumes: [],
    characters: [],
  }

  // Get character name for costume
  const getCharacterName = (characterRef: string | null) => {
    if (!characterRef) return 'Unknown'
    return characters.find((c) => c.characterId === characterRef)?.name || 'Unknown'
  }

  const hasNoElements = locations.length === 0 && props.length === 0 && costumes.length === 0

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

      <StoryboardSidebar activeNav="elements" />

      {/* Main content wrapper - offset for header and sidebar */}
      <div className="pl-[4.5rem] pt-14">
        {/* Main Content */}
        <main className="mx-auto max-w-6xl px-6 py-8">
          {/* Page Title */}
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500">
              <Boxes className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold">Scene Elements</h1>
              <p className="text-sm text-muted-foreground">
                Locations, props, and costumes
              </p>
            </div>
          </div>
          {hasNoElements ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Boxes className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium">No elements yet</h3>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  Generate shots to automatically extract locations, props, and costumes
                </p>
                <Link
                  to="/projects/$projectId/outline"
                  params={{ projectId: project.id }}
                >
                  <Button>Go to Outline Editor</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6 h-auto bg-transparent p-0">
                <TabsTrigger
                  value="locations"
                  className="gap-2 data-[state=active]:bg-pink-500/10 data-[state=active]:text-pink-400"
                >
                  <MapPin className="h-4 w-4" />
                  Locations
                  <Badge variant="secondary" className="ml-1 font-mono text-xs">
                    {locations.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="props"
                  className="gap-2 data-[state=active]:bg-pink-500/10 data-[state=active]:text-pink-400"
                >
                  <Package className="h-4 w-4" />
                  Props
                  <Badge variant="secondary" className="ml-1 font-mono text-xs">
                    {props.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="costumes"
                  className="gap-2 data-[state=active]:bg-pink-500/10 data-[state=active]:text-pink-400"
                >
                  <Shirt className="h-4 w-4" />
                  Costumes
                  <Badge variant="secondary" className="ml-1 font-mono text-xs">
                    {costumes.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Locations */}
              <TabsContent value="locations">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {locations.map((location) => {
                    const TimeIcon = timeOfDayIcons[location.timeOfDayDefault]
                    
                    return (
                      <Card key={location.locationId} className="overflow-hidden">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-pink-400" />
                              <CardTitle className="text-lg">{location.name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <TimeIcon className="h-4 w-4" />
                              <span className="text-xs capitalize">
                                {location.timeOfDayDefault}
                              </span>
                            </div>
                          </div>
                          <CardDescription className="line-clamp-2">
                            {location.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Lighting */}
                          {location.lighting && (
                            <div className="flex items-center gap-2 text-sm">
                              <Lightbulb className="h-4 w-4 text-amber-400" />
                              <span className="text-muted-foreground">{location.lighting}</span>
                            </div>
                          )}

                          {/* Color Palette */}
                          {location.palette && location.palette.length > 0 && (
                            <div>
                              <div className="mb-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <Palette className="h-3 w-3" />
                                Color Palette
                              </div>
                              <div className="flex gap-1">
                                {location.palette.slice(0, 5).map((color, idx) => (
                                  <div
                                    key={idx}
                                    className="h-6 w-6 rounded border border-white/10"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Must Include */}
                          {location.mustInclude && location.mustInclude.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {location.mustInclude.slice(0, 3).map((item, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </TabsContent>

              {/* Props */}
              <TabsContent value="props">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {props.map((prop) => (
                    <Card key={prop.propId}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-cyan-400" />
                            <CardTitle className="text-lg">{prop.name}</CardTitle>
                          </div>
                          {prop.isRecurring && (
                            <Badge variant="secondary" className="text-xs">
                              Recurring
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{prop.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                {props.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No props in this project</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Costumes */}
              <TabsContent value="costumes">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {costumes.map((costume) => (
                    <Card key={costume.costumeId}>
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Shirt className="h-4 w-4 text-purple-400" />
                            <CardTitle className="text-lg">{costume.name}</CardTitle>
                          </div>
                          {costume.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                        <CardDescription>{costume.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Worn by:</span>
                          <Badge variant="outline">
                            {getCharacterName(costume.characterRef)}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {costumes.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Shirt className="mb-4 h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground">No costumes in this project</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </div>
  )
}

