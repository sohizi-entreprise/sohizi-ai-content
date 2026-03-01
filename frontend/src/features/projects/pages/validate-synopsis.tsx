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
import { useResumableStream } from '@/hooks/use-resumable-stream'
import { useEditStream } from '@/hooks/use-edit-stream'
import { SynopsisEditor } from '@/features/text-editor/components/synopsis-editor'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatContainer, useChatStore } from '@/features/chat'
import { sendParams } from '@/features/chat/components/chat-input'


export default function ValidateSynopsis() {
    const { projectId } = useParams({ from: '/dashboard/projects/$projectId/synopsis' })
    const handleStreamEvent = useConceptStore(state => state.handleStreamEvent)
    const isGeneratingSynopsis = useConceptStore(state => state.isGenerating.synopsis)
    const setIsGenerating = useConceptStore(state => state.setIsGenerating)
    const { startStream } = useResumableStream(projectId, {
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
                <RenderChat 
                    projectId={projectId}
                />
            </div>

        </div>
        
    </div>
  )
}

function RenderSynopsis({projectId}: {projectId: string}) {
    const { data } = useSuspenseQuery(getProjectQueryOptions(projectId))
    const isGeneratingSynopsis = useConceptStore(state => state.isGenerating.synopsis)
    const setSynopsis = useConceptStore(state => state.setSynopsis)
    const synopsis = useConceptStore(state => state.synopsis)

    // Initialize store with server data
    // Handle both old format (title/text) and new prose format
    useEffect(() => {
        if (data?.synopsis) {
            // Check if it's already prose format (has 'type' and 'content')
            const serverSynopsis = data.synopsis as { type?: string; content?: unknown[] }
            if (serverSynopsis.type === 'doc' && Array.isArray(serverSynopsis.content)) {
                setSynopsis(data.synopsis)
            }
            // Old format would need conversion - for now just skip
        }
    }, [data?.synopsis, setSynopsis])

    return (
        <div>
            <SynopsisEditor 
                content={synopsis} 
                readOnly={isGeneratingSynopsis}
                onChange={setSynopsis}
            />
        </div>
    )
}

// Edit stream event types
const EDIT_EVENT_TYPES = [
    'editor_start',
    'editor_delta', 
    'editor_end',
    'editor_error',
    'editor_reasoning',
    'editor_tool_call',
    'editor_tool_result',
] as const

// Payload for edit content request
type EditPayload = {
    projectId: string
    component: 'synopsis' | 'script' | 'characters' | 'world'
    prompt: string
    model?: string
    reasoningEffort?: 'low' | 'medium' | 'high'
    context?: {
        blocks?: string[];
        selections?: string[];
    }
}

function RenderChat({projectId}: {projectId: string}) {
    const conversation = useChatStore((state) => state.currentConversation)
    const setStreaming = useChatStore((state) => state.setStreaming)
    
    // Configure the edit stream hook
    // TODO: Use isStreaming and cancel for UI feedback and cancellation
    const { startEdit } = useEditStream<EditPayload>(
        {
            requestUrl: `/chat/conversations/${conversation?.id}/messages`,
            streamUrl: '/chat/conversations/{id}/stream',
            cancelUrl: '/chat/conversations/{id}/stream',
            eventTypes: EDIT_EVENT_TYPES,
        },
        {
            onEvent: (event) => {
                // Handle different event types
                if (event.event === 'editor_delta') {
                    const data = event.data as { type?: string; text?: string; runId?: string }
                    if (data.type === 'content' && data.text) {
                        // Append to the current streaming message
                        // This would need the message ID from somewhere
                        console.log('[Edit] Delta:', data.text)
                    }
                }
            },
            onStart: () => {
                setStreaming(true)
                console.log('[Edit] Stream started')
            },
            onComplete: () => {
                setStreaming(false)
                console.log('[Edit] Stream completed')
            },
            onError: (error) => {
                setStreaming(false)
                console.error('[Edit] Stream error:', error)
            },
            onCancel: () => {
                setStreaming(false)
                console.log('[Edit] Stream cancelled')
            },
        }
    )

    const onSubmit = async (params: sendParams) => {
        if (!conversation?.id) {
            console.error('No conversation ID')
            return
        }

        await startEdit({
            projectId,
            component: 'synopsis',
            prompt: params.prompt,
            context: params.context,
        })
    }

    return (
        <ChatContainer 
            projectId={projectId} 
            editorType="synopsis"
            onSubmit={onSubmit}
        />
    )
}
