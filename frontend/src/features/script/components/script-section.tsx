import { Button } from '@/components/ui/button'
import { IconLoader2, IconRefresh } from '@tabler/icons-react'
import SceneListPanel from './scene-list-panel'
import { ScenesEditor } from './scenes-editor'
import { useScriptStore } from '@/features/projects/store/script-store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { getGenerateContentMutationOptions, getGetScenesQueryOptions } from '@/features/projects/query-mutation'
import { useGetSSE } from '@/hooks/use-get-sse'
import { sseSceneEventHandlers, sseScriptEventHandlers } from '@/features/projects/event-handlers'
import OverLayStreamingProgress from './loader-overlay'
import { TextSkeleton } from '@/features/text-editor/components/text-skeleton'


export default function ScriptSection({ 
  projectId,
}: { 
  projectId: string
}) {

  const {data: scenesData, isLoading} = useQuery(getGetScenesQueryOptions(projectId))
  // console.log('scenesData', scenesData)
  // Regenerate function
  const {mutate: generateContent, isPending: isRequestPending} = useMutation(getGenerateContentMutationOptions(projectId))
  const subscribe = useGetSSE({eventFuncMap: {...sseSceneEventHandlers, ...sseScriptEventHandlers}})

  const isStreaming = useScriptStore(state => state.isGenerating.scene)

  const handleRegenerate = () => {
    generateContent('scenes', {
      onSuccess: (data) => {
        const sseUrl = `${import.meta.env.VITE_API_BASE_URL}/stream/${data.streamId}`
        subscribe(sseUrl)
      },
    })
  }

  if (isStreaming) {
    return <SceneStreamingLoader />
  }
  if(isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="relative h-full">
      {/* Scene List Overlay Panel */}
      <SceneListPanel />

      {/* Center - Script Canvas */}
      <div className="h-full">
        <div className="flex min-h-full flex-col items-center py-6">
          {/* Top bar with regenerate button */}
          <div className="mb-4 flex max-w-paper container mx-auto justify-end items-center">
            <Button size="sm" onClick={handleRegenerate} disabled={isRequestPending || isStreaming}>
              {
                isRequestPending ? <IconLoader2 className="size-4 animate-spin" /> : <IconRefresh className="size-4" />
              }
                Regenerate
            </Button>
          </div>

          {/* A4 Paper Canvas */}
          <ScenesEditor 
            onChange={(content) => {
              console.log('Editor content changed:', content)
            }}
            content={scenesData}
          />
        </div>
      </div>
    </div>
  )
}

function SceneStreamingLoader(){

  return (
    <>
      <div className='space-y-6 bg-white container max-w-paper mx-auto py-6 px-paper-pad mt-18'>
        <TextSkeleton />
        <TextSkeleton />
        <TextSkeleton />
        <TextSkeleton />
      </div>
      <OverLayStreamingProgress className='absolute inset-0'>
        Streaming Progress
      </OverLayStreamingProgress>
    </>
  )
}
