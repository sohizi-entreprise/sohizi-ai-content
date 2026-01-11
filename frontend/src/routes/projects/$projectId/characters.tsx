import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
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
import { StoryboardSidebar } from '@/components/storyboard-sidebar'
import { UserMenu } from '@/components/user-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { Users, User, Crown, Skull, UserCircle, Mic2, ChevronRight } from 'lucide-react'
import type { CharacterRole } from '@/lib/types'

const projectQueryOptions = (projectId: string) => ({
  queryKey: ['project', projectId],
  queryFn: () => getProject({ data: { projectId } }),
})

const storyboardQueryOptions = (projectId: string) => ({
  queryKey: ['storyboard', projectId],
  queryFn: () => getStoryboard({ data: { projectId } }),
})

export const Route = createFileRoute('/projects/$projectId/characters')({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(projectQueryOptions(params.projectId))
    context.queryClient.ensureQueryData(storyboardQueryOptions(params.projectId))
  },
  component: CharactersPage,
  pendingComponent: CharactersSkeleton,
})

function CharactersSkeleton() {
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

const roleIcons: Record<CharacterRole, typeof Crown> = {
  protagonist: Crown,
  antagonist: Skull,
  supporting: UserCircle,
  narrator: Mic2,
  unknown: User,
}

const roleColors: Record<CharacterRole, string> = {
  protagonist: 'from-amber-500 to-yellow-500',
  antagonist: 'from-red-500 to-rose-500',
  supporting: 'from-blue-500 to-cyan-500',
  narrator: 'from-violet-500 to-purple-500',
  unknown: 'from-gray-500 to-slate-500',
}

const roleBadgeColors: Record<CharacterRole, string> = {
  protagonist: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  antagonist: 'bg-red-500/10 text-red-400 border-red-500/20',
  supporting: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  narrator: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  unknown: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

function CharactersPage() {
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

  const characters = storyboard.entities?.characters || []

  // Get costumes for each character
  const getCharacterCostumes = (characterId: string) => {
    return storyboard.entities?.costumes.filter(
      (c) => c.characterRef === characterId
    ) || []
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

      <StoryboardSidebar activeNav="characters" />

      {/* Main content wrapper - offset for header and sidebar */}
      <div className="pl-[4.5rem] pt-14">
        {/* Main Content */}
        <main className="mx-auto max-w-6xl px-6 py-8">
          {/* Page Title */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold">Characters</h1>
                <p className="text-sm text-muted-foreground">
                  {characters.length} character{characters.length !== 1 ? 's' : ''} in this project
                </p>
              </div>
            </div>
          </div>

          {characters.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((character) => {
                const RoleIcon = roleIcons[character.role]
                const costumes = getCharacterCostumes(character.characterId)
                
                return (
                  <Card
                    key={character.characterId}
                    className="group overflow-hidden transition-all hover:border-white/20 hover:shadow-lg"
                  >
                    {/* Character Avatar Header */}
                    <div className={`relative h-20 bg-gradient-to-br ${roleColors[character.role]}`}>
                      <div className="absolute -bottom-8 left-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-card shadow-lg">
                          <RoleIcon className="h-7 w-7 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                    
                    <CardHeader className="pb-2 pt-10">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-xl">{character.name}</CardTitle>
                        <Badge 
                          variant="outline" 
                          className={`capitalize ${roleBadgeColors[character.role]}`}
                        >
                          {character.role}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-3">
                        {character.description}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      {/* Locked Traits */}
                      {character.lockedTraits && character.lockedTraits.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                            Key Traits
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {character.lockedTraits.slice(0, 4).map((trait, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {trait}
                              </Badge>
                            ))}
                            {character.lockedTraits.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{character.lockedTraits.length - 4}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Costumes */}
                      {costumes.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                            Costumes
                          </p>
                          <div className="space-y-1">
                            {costumes.slice(0, 2).map((costume) => (
                              <div
                                key={costume.costumeId}
                                className="rounded-md bg-muted/50 px-2 py-1 text-xs"
                              >
                                <span className="font-medium">{costume.name}</span>
                                {costume.isDefault && (
                                  <Badge variant="outline" className="ml-2 text-[10px]">
                                    Default
                                  </Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-medium">No characters yet</h3>
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  Generate shots to automatically extract characters from your story
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
      </div>
    </div>
  )
}

