import { Suspense, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IconPlus, IconX, IconUser, IconMapPin, IconBox, IconRefresh, IconTrash, IconLoader2 } from '@tabler/icons-react'
import { useMutation, useQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query'
import { getEntityQueryOptions, getGenerateContentMutationOptions, getInfiniteListEntitiesQueryOptions } from '@/features/projects/query-mutation'
import { useGetSSE } from '@/hooks/use-get-sse'
import { sseCharacterEventHandlers } from '@/features/projects/event-handlers'
import { useScriptStore } from '@/features/projects/store/script-store'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Route } from '@/routes/dashboard/projects/$projectId/edit/script'
import { CharacterEntity, Entity, EntityType, LocationEntity, PropEntity } from '@/features/projects/type'
import { CharacterDetailView, LocationDetailView, PropDetailView } from './entities-views'
import { TextSkeleton } from '@/features/text-editor'

// Types matching zSchemas
type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor'

type TabEntityType = 'characters' | 'locations' | 'props'

const ROLE_COLORS: Record<CharacterRole, { bg: string; text: string }> = {
  protagonist: { bg: 'bg-green-500/20', text: 'text-green-600' },
  antagonist: { bg: 'bg-red-500/20', text: 'text-red-400' },
  supporting: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  minor: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
}

const TAB_CONFIG = [
  { id: 'characters' as const, label: 'Characters', icon: IconUser },
  { id: 'locations' as const, label: 'Locations', icon: IconMapPin },
  { id: 'props' as const, label: 'Props', icon: IconBox },
]

export default function EntitiesSection({ 
  projectId
}: { 
  projectId: string
}) {

  return (
    <div className="relative h-full">
      <Suspense fallback={<EntityLoadingView />}>
        <EntityList projectId={projectId} />
      </Suspense>
    </div>
  )
}

function EntityList({projectId}: {projectId: string}){
  const searchParams = useSearch({from: Route.id})
  const {entityType = 'characters', entityId} = searchParams
  const serverEntityMap: Record<TabEntityType, EntityType> = {
    characters: 'CHARACTER',
    locations: 'LOCATION',
    props: 'PROP',
  }
  const {data: entities} = useSuspenseInfiniteQuery(getInfiniteListEntitiesQueryOptions(projectId, undefined, undefined, serverEntityMap[entityType]))
  const navigate = useNavigate({from: Route.id})

  const firstEntityId = entities[0]?.id
  
  useEffect(()=>{
    // Let's render the first element if no entity is selected
    if(firstEntityId && !entityId) {
      navigate({ search: {...searchParams, entityType, entityId: firstEntityId}})
    }

  }, [firstEntityId, entityId])

  return (
    <>
    <EntityListPanel
      entities={entities}
    />
    <EntityDetailView projectId={projectId} />
    </>
  )
}

function EntityDetailView({projectId}: {projectId: string}){

  const searchParams = useSearch({from: Route.id})
  const {entityType = 'characters', entityId} = searchParams
  const isCreation = entityId === 'new'
  const sendId = isCreation ? undefined : entityId!

  const {data: entity, isLoading} = useQuery(getEntityQueryOptions(projectId, sendId))

  // Regenerate function
  const {mutate: generateContent, isPending: isRequestPending} = useMutation(getGenerateContentMutationOptions(projectId))
  const subscribe = useGetSSE({eventFuncMap: sseCharacterEventHandlers})

  const isStreaming = useScriptStore(state => state.isGenerating.character)

  const handleRegenerate = () => {
    generateContent('characters', {
      onSuccess: (data) => {
        const sseUrl = `${import.meta.env.VITE_API_BASE_URL}/stream/${data.streamId}`
        subscribe(sseUrl)
      },
    })
  }

  const getEntityDetailView = useCallback((entity: Entity | undefined)=>{
    switch(entityType){
      case 'characters':
        return <CharacterDetailView data={entity as CharacterEntity} isCreation={isCreation} onChange={console.log}/>
      case 'locations':
        return <LocationDetailView data={entity as LocationEntity} isCreation={isCreation} onChange={console.log}/>
      case 'props':
        return <PropDetailView data={entity as PropEntity} isCreation={isCreation} onChange={console.log}/>
      default:
        return null
    }
  }, [entityType])

  const entityNotFound = !entity && !isCreation

  if (isLoading) {
    return <EntityLoadingView />
  }

  if (entityNotFound) {
    return <div>Entity not found</div>
  }

  // if (!entity) {
  //   return <div>Entity not found!!!</div>
  // }



  return (
    <div className="h-full">
      <div className="flex min-h-full flex-col items-center py-6">
        <div className='flex items-center justify-end gap-4 w-paper mb-4'>
          <Button variant="outline" size="sm" className='border-white/10! text-foreground/70 hover:text-foreground hover:bg-transparent!'>
            <IconTrash className="size-4" />
          </Button>
          <Button size="sm" onClick={handleRegenerate} disabled={isStreaming || isRequestPending}>
            {
              isRequestPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />
            }
            Regenerate
          </Button>
        </div>
        {/* Entity Detail Card */}
        <div className="bg-white p-[1in] w-paper min-h-[11in]">
          {getEntityDetailView(entity)}
        </div>
      </div>
    </div>
  )
}


// Entity List Panel Component
function EntityListPanel({
  entities
}: {
  entities: Entity[]
}) {

  const searchParams = useSearch({from: Route.id})
  const navigate = useNavigate({from: Route.id})
  const showLayers = useScriptStore(state => state.showLayers.entities)
  const setShowLayers = useScriptStore(state => state.setShowLayers)

  const {entityType: activeTab, entityId: selectedEntityId} = searchParams

  const onTabChange = (tab: TabEntityType) => {
    const {entityId, ...rest} = searchParams
    navigate({ search: {...rest, entityType: tab}})
  } 
  const onSelectEntity = (id: string) => {
    navigate({ search: {...searchParams, entityId: id}})
  }
  const onAddEntity = () => {
    navigate({ search: {...searchParams, entityId: "new"}})
  }
  const onClose = () => {
    setShowLayers('entities', false)
  }

  if (!showLayers) {
    return null
  }

  return (
    <div className="absolute left-0 top-0 z-10 h-full w-72 border-r border-zinc-800 bg-zinc-900/95 backdrop-blur-sm">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-200">Entities</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <IconX className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-y-auto p-2">
        {
          entities.map((entity) => (
            <button
              key={entity.id}
              onClick={() => onSelectEntity(entity.id)}
              className={cn(
                'mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                selectedEntityId === entity.id
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-300">
                {
                  activeTab === 'locations' ?
                  <IconMapPin className="h-4 w-4 text-zinc-300" /> :
                  activeTab === 'props' ?
                  <IconBox className="h-4 w-4 text-zinc-300" /> :
                  entity.name.charAt(0)
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{entity.name}</div>
                {
                  'role' in entity && (
                    <div className={cn('text-xs capitalize', ROLE_COLORS[(entity.role as CharacterRole)].text)}>
                      {entity.role as string}
                    </div>
                  )
                }
              </div>
            </button>

          ))
        }
      </div>

      {/* Add Button */}
      <div className="border-t border-zinc-800 p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-zinc-700 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          onClick={onAddEntity}
        >
          <IconPlus className="mr-1.5 h-4 w-4" />
          Add {activeTab === 'characters' ? 'Character' : activeTab === 'locations' ? 'Location' : 'Prop'}
        </Button>
      </div>
    </div>
  )
}

function EntityLoadingView(){
  return (
    <div className='container mx-auto max-w-paper mt-18 p-paper-pad bg-white'>
      <div className='flex items-start gap-4 mb-4'>
        <div className='size-20 rounded-full bg-slate-500/20 animate-pulse'/>
        <div className='flex-1 space-y-6'>
          <div className='flex items-center gap-2'>
            <div className='h-6 w-50 rounded-full bg-slate-500/20 animate-pulse'/>
            <div className='h-6 w-25 rounded-full bg-slate-500/20 animate-pulse ml-auto'/>
          </div>
          <div className='flex items-start gap-4 space-y-2'>
            <div className='h-4 w-30 rounded-full bg-slate-500/20 animate-pulse'/>
            <div className='h-4 w-20 rounded-full bg-slate-500/20 animate-pulse'/>
            <div className='h-4 w-35 rounded-full bg-slate-500/20 animate-pulse'/>
          </div>

        </div>
      </div>
      <div className='w-full h-px bg-slate-500/40 my-4'/>
      <div className='space-y-4'>
        <TextSkeleton />
        <TextSkeleton />
        <TextSkeleton />
      </div>

    </div>
  )
}
