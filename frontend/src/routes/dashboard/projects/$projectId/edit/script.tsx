import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useScriptStore } from '@/features/projects/store/script-store'
import AiBlockEditor from '@/features/script/components/ai-block-editor'
import AiTab from '@/features/script/components/ai-tab'
// import RenderCanvas from '@/features/script/components/render-canvas'
import EntitiesSection from '@/features/script/components/entities-section'
import ScriptSection from '@/features/script/components/script-section'
import WorldSection from '@/features/script/components/world-section'
import { cn } from '@/lib/utils'
import { IconLayoutSidebarLeftExpand, IconLayoutSidebarRightExpand, IconStack2 } from '@tabler/icons-react'
import { createFileRoute, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import z from 'zod'

const TABS = ['script', 'elements', 'outline', 'world'] as const;
const ENTITY_TYPES = ['characters', 'locations', 'props'] as const;

export const Route = createFileRoute('/dashboard/projects/$projectId/edit/script')({
  validateSearch: z.object({
    view: z.enum(TABS).optional().default('script'),
    entityType: z.enum(ENTITY_TYPES).optional(),
    entityId: z.string().optional(),
    sceneId: z.string().optional(),
  }),
  component: ScriptPage,
  notFoundComponent: () => <div>Project not found</div>,
  errorComponent: ({error}) => <div className='text-red-500'>Error script project: {error.message}</div>,
})

function ScriptPage() {
  const { projectId } = useParams({ from: Route.id })
  const { view } = useSearch({ from: Route.id })

  return (
    <>
    <div className='flex h-full'>
      <div className='flex-1 bg-white/5 overflow-y-auto overscroll-none transition-all duration-300 ease-in-out'>
        <ScriptHeader />
        {view === 'world' && <WorldSection projectId={projectId} />}
        {view === 'elements' && <EntitiesSection projectId={projectId} />}
        {(view === 'script') && <ScriptSection projectId={projectId} />}
        {(view === 'outline') && <ScriptSection projectId={projectId} />}
      </div>

      <RightSideHeader projectId={projectId} />
    </div>
    </>
  )
}

function ScriptHeader() {
  const toggleLayer = useScriptStore(state => state.toggleLayer)
  const {view} = useSearch({from: Route.id})

  const mapViewToLayerType = {
    script: 'scenes',
    elements: 'entities',
    outline: undefined,
    world: undefined,
  } as const

  const isPanelOpen = useScriptStore(state => mapViewToLayerType[view] ? state.showLayers[mapViewToLayerType[view]] : false)
  const isChatOpen = useScriptStore(state => state.openChat)
  const toggleChat = useScriptStore(state => state.toggleChat)

  const showLayerButton = !!mapViewToLayerType[view]

  const onToggleLayers = () => {
    const layerType = mapViewToLayerType[view]
    if (!layerType) return;
    toggleLayer(layerType)
  }

  return (
    <div className='w-full h-10 bg-background/80 backdrop-blur-xl sticky top-0 flex items-center justify-between px-4 border-b border-white/7 z-10'>
      <div className='flex items-center gap-2 text-muted-foreground'>
        {showLayerButton && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleLayers} 
            className={cn(
              'text-muted-foreground hover:bg-transparent! hover:text-foreground!',
              isPanelOpen && 'text-primary'
            )}
          >
            <IconStack2 className='size-5'/>
          </Button>
        )}
      </div>

      <SectionTabs />

      <div className='flex items-center gap-2'>
        <Button variant="ghost" size="icon" onClick={toggleChat} className='text-muted-foreground hover:bg-transparent! hover:text-foreground!'>
          {isChatOpen ? (
            <IconLayoutSidebarRightExpand className='size-5'/>
          ) : (
            <IconLayoutSidebarLeftExpand className='size-5'/>
          )}
        </Button>
      </div>
    </div>
  )
}


function RightSideHeader({projectId}: {projectId: string}){
  const isChatOpen = useScriptStore(state => state.openChat)
  return (
    <div className={cn(
      "h-calc(100%-var(--header-height)) transition-all duration-300 ease-in-out overflow-hidden",
      isChatOpen ? "w-80" : "w-0 border-l-0"
    )}>
      <div className="w-80 h-full border-l border-white/10">
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 min-h-0 px-4 pt-2">
                <AiTab />
            </ScrollArea>
            <div className='px-4 pb-4'>
                <AiBlockEditor projectId={projectId} />
            </div>
        </div>
      </div>
    </div>
  )
}


function SectionTabs(){

  const {view} = useSearch({from: Route.id})
  const navigate = useNavigate({from: Route.id})
  const {projectId} = useParams({from: Route.id})

  const isActive = (tab: typeof TABS[number]) => {
    return view === tab
  };

  return (
    <div className='flex items-center'>
      {TABS.map((tab) => (
        <div className='relative w-fit' key={tab}>
          <Button variant="ghost" 
                  size="sm" 
                  className={cn('uppercase text-xs text-muted-foreground hover:text-foreground hover:bg-transparent!', isActive(tab) && 'text-primary')}
                  onClick={() => navigate({to: Route.id, params: {projectId}, search: {view: tab}})}
          >
            {tab}
          </Button>

          {
            isActive(tab) && (
              <div className='bg-primary shadow-primary w-full h-[2px]'/>
            )
          }
        </div>
      ))}
    </div>
  )
}
