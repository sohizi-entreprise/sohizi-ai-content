import Container from '@/components/layout/container'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Suspense, useEffect } from 'react'
import StepMarker from '../components/step-marker'
import { Button } from '@/components/ui/button'
import NewProjectHeader from '../components/new-project-header'
import { IconLoader2, IconSparkles2 } from '@tabler/icons-react'
import { useParams } from '@tanstack/react-router'
import { useConceptStore } from '../store/concept-store'
import { useResumableStream } from '@/hooks/use-resumable-stream'
import { ChatContainer } from '@/features/chat/components/chat-container'
import { useGetSSE } from '@/hooks/use-get-sse'
import { sseEditorEventHandlers } from '@/features/chat/event-handlers'
import SynopsisEditor from '../components/synopsis-editor'
import { TextSkeleton } from '@/features/text-editor'
import { useChatStore } from '@/features/chat/store/chat-store'

export default function SynopsisPage() {
    const { projectId } = useParams({ from: '/dashboard/projects/$projectId/synopsis' })
    const handleStreamEvent = useConceptStore(state => state.handleStreamEvent)
    const isGeneratingSynopsis = useConceptStore(state => state.isGenerating.synopsis)
    const setIsGenerating = useConceptStore(state => state.setIsGenerating)
    const { startStream } = useResumableStream(projectId, {
        autoSubscribe: true,
        onEvent: handleStreamEvent,
        onError: (_error) => {
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
                    <Suspense fallback={<SynopsisLoader />}>
                        <SynopsisEditor projectId={projectId} />
                    </Suspense>
                </Container>
            </ScrollArea>

            <div className='w-96 border-l pt-header'>
                <RenderChat 
                    projectId={projectId}
                />
            </div>

        </div>
    </div>
  )
}


function RenderChat({projectId}: {projectId: string}) {

    const conversationId = useChatStore(state => state.activeConversationId)

    const subscribe = useGetSSE({
        eventFuncMap: sseEditorEventHandlers,
    })

    useEffect(() => {
        let unsubscribe: () => void;
        if (conversationId) {
            const url = `${import.meta.env.VITE_API_BASE_URL}/chats/${projectId}/conversations/${conversationId}/stream`
            console.log('Subscribed to stream', url)
            unsubscribe = subscribe(url)
        }
        return () => {
            unsubscribe?.()
        }
    }, [conversationId, subscribe])

    return (
        <ChatContainer 
            projectId={projectId} 
            editorType="synopsis"
        />
    )
}

function SynopsisLoader(){
    return (
        <div className='main-editor-content space-y-6'>
            <TextSkeleton />
            <TextSkeleton />
            <TextSkeleton />
        </div>
    )
}
