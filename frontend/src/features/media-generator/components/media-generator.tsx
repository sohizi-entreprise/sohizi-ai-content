import { ImagePlus, Sparkles } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useState } from 'react'
import { mediaFilterOptions } from '../constants'
import { useMediaGeneratorStore } from '../store/media-generator-store'
import { MediaCard } from './media-card'
import type { MediaFilter } from '../types'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import MediaChat from './media-chat'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listAiGeneratedAssetsQueryOptions } from '../query-mutations'
import MediaLoader from './media-loader'

export function MediaGenerator() {
  const { projectId } = useParams({
    from: '/dashboard/projects/$projectId',
  })

  const [filter, setFilter] = useState<MediaFilter>('all')
 

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel
        id="file-explorer"
        defaultSize={50}
        minSize={40}
        maxSize={50}
        className="rounded-2xl mb-2 bg-white/10"
      >
        <MediaChat projectId={projectId} />
      </ResizablePanel>

      <ResizableHandle className="mx-1 bg-transparent" />

      <ResizablePanel
        id="editor-workspace"
        defaultSize={50}
        minSize={50}
        className=""
      >
        <div className="flex h-full w-full flex-col">
          <RenderHeader filter={filter} setFilter={setFilter} />

          <ScrollArea className="flex-1 min-h-0">
            <RenderAssets projectId={projectId} />
          </ScrollArea>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function RenderAssets({projectId}: {projectId: string}){

  const {data: assets, isLoading} = useInfiniteQuery(listAiGeneratedAssetsQueryOptions(projectId))
  const activeGenerationRequests = useMediaGeneratorStore((state) => state.activeGenerationRequests)

  if(isLoading){
    return (
      <div className='flex-1 flex items-center justify-center'>...loading</div>
    )
  }

  if(!assets || assets.length === 0){
    return <EmptyMediaState />
  }

  return (

    <div className="">
      <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {activeGenerationRequests.map((request) => (
            <MediaLoader key={request.requestId} />
        ))}
        {assets.map((asset) => (
          <MediaCard
            key={asset.id}
            item={asset}
            projectId={projectId}
          />
        ))}
      </div>

    </div>

  )

}

function RenderHeader(props: {
  filter: MediaFilter
  setFilter: (filter: MediaFilter) => void
}) {
  const { filter, setFilter } = props
  return (
    <header className="px-6 py-5 bg-black/20 backdrop-blur-md rounded-2xl flex items-center justify-between relative z-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-primary">
            <Sparkles className="size-4" />
            AI media
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Media generator history
          </h1>
        </div>
      </div>

      <Tabs
        value={filter}
        onValueChange={(value) => setFilter(value as MediaFilter)}
        // className="mt-5"
      >
        <TabsList className="h-11 rounded-2xl border bg-black/40 p-1">
          {mediaFilterOptions.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className={cn(
                'rounded-xl px-5 text-sm text-zinc-300',
                'data-[state=active]:bg-white/15 data-[state=active]:text-white',
              )}
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </header>
  )
}

function EmptyMediaState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-card">
          <ImagePlus className="size-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-foreground">
          No media generated yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Use the media settings to create mock images, videos, or audio for
          this project.
        </p>
      </div>
    </div>
  )
}
