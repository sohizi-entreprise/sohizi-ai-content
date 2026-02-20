import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import AiBlockEditor from '@/features/script/components/ai-block-editor'
import AiTab from '@/features/script/components/ai-tab'
import RenderCanvas from '@/features/script/components/render-canvas'
import { cn } from '@/lib/utils'
import { IconLayoutSidebarLeftExpand, IconLayoutSidebarRightExpand } from '@tabler/icons-react'
import { createFileRoute, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import z from 'zod'

const TABS = ['script', 'elements', 'outline', 'brief'] as const;

export const Route = createFileRoute('/dashboard/projects/$projectId/edit/script')({
  validateSearch: z.object({
    view: z.enum(TABS).optional().default('script'),
  }),
  component: ScriptPage,
  notFoundComponent: () => <div>Project not found</div>,
  errorComponent: ({error}) => <div className='text-red-500'>Error script project: {error.message}</div>,
})

function ScriptPage() {
  
  const {projectId} = useParams({from: '/dashboard/projects/$projectId/edit/script'})
  const [openAiPanel, setOpenAiPanel] = useState(true)

  return (
    <div className='flex h-full'>
      <div className='flex-1 overflow-y-auto overscroll-none bg-white/5 transition-all duration-300 ease-in-out'>
        <ScriptHeader onTogglePanel={() => setOpenAiPanel(prev => !prev)} isPanelOpen={openAiPanel} />
        <RenderCanvas />
      </div>

      <div className={cn(
        "h-calc(100%-var(--header-height)) transition-all duration-300 ease-in-out overflow-hidden",
        openAiPanel ? "w-80" : "w-0 border-l-0"
      )}>
        <div className="w-80 h-full">
          <RightSideHeader projectId={projectId} />
        </div>
      </div>

    </div>
  )
}

function ScriptHeader({ onTogglePanel, isPanelOpen }: { onTogglePanel: () => void; isPanelOpen: boolean }) {
  return (
    <div className='w-full h-10 bg-background/80 backdrop-blur-xl sticky top-0 flex items-center justify-between px-4 border-b border-white/7 z-10'>
      <div className='flex items-center gap-2 text-muted-foreground'>
          xxx
      </div>

      <SectionTabs />

      <div className='flex items-center gap-2'>
        <Button variant="ghost" size="icon" onClick={onTogglePanel} className='text-muted-foreground hover:bg-transparent! hover:text-foreground!'>
          {isPanelOpen ? (
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
  return (
      <div className="flex flex-col h-full">
          <ScrollArea className="flex-1 min-h-0 px-4 pt-2">
              <AiTab />
          </ScrollArea>
          <div className='px-4 pb-4'>
              <AiBlockEditor projectId={projectId} />
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
