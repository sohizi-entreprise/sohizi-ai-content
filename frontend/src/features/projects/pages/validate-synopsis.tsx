import NewProjectHeader from '../components/new-project-header'
import StepMarker from '../components/step-marker'
import Container from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import {IconLoader2, IconSparkles2 } from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Suspense, useEffect } from 'react'
import { getProjectQueryOptions } from '../query-mutation'
import { useConceptStore } from '../store/concept-store'
import { Synopsis } from '../type'
import { useResumableStream } from '@/hooks/use-resumable-stream'
import { SynopsisEditor } from '@/features/text-editor/components/synopsis-editor'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatContainer } from '@/features/chat'


export default function ValidateSynopsis() {
    const { projectId } = useParams({ from: '/dashboard/projects/$projectId/synopsis' })
    const handleStreamEvent = useConceptStore(state => state.handleStreamEvent)
    const isGeneratingSynopsis = useConceptStore(state => state.isGenerating.synopsis)
    const setIsGenerating = useConceptStore(state => state.setIsGenerating)
    const { startStream } = useResumableStream<Partial<Synopsis>>(projectId, {
        autoSubscribe: true,
        onEvent: handleStreamEvent,
        onError: (_error) => {
            // console.error('stream error:', error)
        }
    })
    const regenerateSynopsis = () => {
        setIsGenerating('synopsis', true)
        startStream('synopsis')
    }

  return (
    <div className='h-screen'>
        <NewProjectHeader currentStep="drafting" className='fixed top-0 left-0 right-0'/>
        <div className='flex h-full'>
            <ScrollArea className='flex-1 min-h-0 relative'>
                <Container className='pt-[calc(var(--spacing-header)+2rem)] pb-32 space-y-16 max-w-4xl'>
                    <div className='flex items-center justify-between'>
                        <StepMarker step="03" 
                                    title="Validate your story draft" 
                                    description="We've distilled your idea into three distinct directions. Select one to begin structuring your screenplay." 
                        />
                        <Button onClick={regenerateSynopsis} className='font-bold' disabled={isGeneratingSynopsis}>
                            {isGeneratingSynopsis ? <IconLoader2 className='size-4 animate-spin' /> : <IconSparkles2 className='size-4' />}
                            {isGeneratingSynopsis ? 'Generating...' : 'Regenerate'}
                        </Button>
                    </div>
                    <Suspense fallback={<div>Loading...</div>}>
                        <RenderSynopsis projectId={projectId} />
                    </Suspense>
                </Container>
            </ScrollArea>

            <div className='w-96 border-l pt-header'>
                <ChatContainer 
                    projectId={projectId} 
                    editorType="synopsis"
                />
            </div>

        </div>
        
    </div>
  )
}

function RenderSynopsis({projectId}: {projectId: string}) {
    const { data } = useSuspenseQuery(getProjectQueryOptions(projectId))
    const isGeneratingSynopsis = useConceptStore(state => state.isGenerating.synopsis)
    const updateSynopsis = useConceptStore(state => state.updateSynopsis)
    const setSynopsis = useConceptStore(state => state.setSynopsis)
    const synopsis = useConceptStore(state => state.synopsis)

    // Initialize store with server data
    useEffect(() => {
        if (data?.synopsis) {
            setSynopsis(data.synopsis)
        }
    }, [data?.synopsis, setSynopsis])

    const title = synopsis?.title ?? ''
    const text = synopsis?.text ?? ''

    return (
        <div>
            <SynopsisEditor content={{title, text}} 
                            readOnly={isGeneratingSynopsis}
                            onChange={updateSynopsis}
            />
        </div>
    )
}
