import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  IconFileText,
  IconListDetails,
  IconX,
  IconSparkles,
} from '@tabler/icons-react'
import { OutlineTab } from './outline-tab'
import { BriefTab } from './brief-tab'
import AiBlockEditor from './ai-block-editor'
import AiTab from './ai-tab'

interface ScriptRightPanelProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

export default function ScriptRightPanel({
  projectId,
  isOpen,
  onClose,
}: ScriptRightPanelProps) {

  const [activeTab, setActiveTab] = useState<'ai' | 'outline' | 'brief'>('ai')

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-40 flex flex-col w-[480px] border-l border-white/10 bg-linear-to-b from-zinc-900/95 via-zinc-900/90 to-zinc-950/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-200 uppercase">
          Context Panel
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="size-8 text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
        >
          <IconX className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'ai' | 'outline' | 'brief')}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <div className="px-4 pt-3 pb-2">
          <TabsList className="w-full bg-zinc-800/50 border border-white/5">
            <TabsTrigger
              value="ai"
              className="size-9 rounded-full p-0 flex items-center justify-center data-[state=active]:bg-linear-to-br data-[state=active]:from-emerald-500/30 data-[state=active]:to-green-500/30 data-[state=active]:text-emerald-300 data-[state=active]:border-emerald-500/40 transition-all duration-300 ease-in-out hover:scale-105"
            >
              <IconSparkles className="size-4" />
            </TabsTrigger>
            <TabsTrigger
              value="outline"
              className="flex-1 gap-2 data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 data-[state=active]:border-emerald-500/30 transition-all duration-300 ease-in-out"
            >
              <IconListDetails className="size-4" />
              Outline
            </TabsTrigger>
            <TabsTrigger
              value="brief"
              className="flex-1 gap-2 data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-400 data-[state=active]:border-amber-500/30 transition-all duration-300 ease-in-out"
            >
              <IconFileText className="size-4" />
              Brief
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
          <TabsContent 
            value="ai" 
            className="m-0 flex-1 flex flex-col animate-in fade-in-50 slide-in-from-right-5 duration-300 overflow-hidden"
          >
            <ScrollArea className="flex-1 min-h-0 px-4 pt-2">
                <AiTab />
            </ScrollArea>
            <div className='px-4 pb-4'>
              <AiBlockEditor projectId={projectId} />
            </div>
          </TabsContent>
          <TabsContent 
            value="outline" 
            className="m-0 animate-in fade-in-50 slide-in-from-right-5 duration-300"
          >
            <ScrollArea className="h-full p-4 pt-2">
              <OutlineTab />
            </ScrollArea>
          </TabsContent>
          <TabsContent 
            value="brief" 
            className="m-0 animate-in fade-in-50 slide-in-from-right-5 duration-300"
          >
            <ScrollArea className="h-full p-4 pt-2">
              <BriefTab projectId={projectId} />
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>

      {/* Decorative gradient line */}
      <div className="absolute left-0 top-0 w-px h-full bg-linear-to-b from-emerald-500/50 via-green-500/30 to-transparent" />
    </div>
  )
}