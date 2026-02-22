import NewProjectHeader from '../components/new-project-header'
import Container from '@/components/layout/container'
import StepMarker from '../components/step-marker'
import React, { Suspense, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { IconArrowNarrowRight, IconCircleCheckFilled, IconLoader2, IconSparkles2 } from '@tabler/icons-react'
import { Textarea } from '@/components/ui/textarea'
import { useSuspenseQuery } from '@tanstack/react-query'
import { getProjectQueryOptions } from '../query-mutation'
import { useParams } from '@tanstack/react-router'
import { useResumableStream } from '@/hooks/use-resumable-stream'
import { useConceptStore } from '../store/concept-store'
import { useShallow } from 'zustand/shallow'
import { NarrativeArc } from '../type'


type ConceptCardProps = {
    index: number
}

export default function ChooseConcept() {
    const { projectId } = useParams({ from: '/dashboard/projects/$projectId/concept' })
    const handleStreamEvent = useConceptStore(state => state.handleStreamEvent)
    const setIsGenerating = useConceptStore(state => state.setIsGenerating)
    const isGenerating = useConceptStore(state => state.isGenerating)
    
    const { startStream } = useResumableStream<Partial<NarrativeArc>[]>(projectId, {
        autoSubscribe: true,
        onEvent: handleStreamEvent,
        onError: (error) => {
            console.error('stream error:', error)
        }
    })
    const regenerateConcept = () => {
        setIsGenerating(true)
        startStream('concept')
    }

    return (
        <div>
            <NewProjectHeader currentStep="concepts" />
            <Container className='pt-8 pb-[140px] space-y-8'>
                <div className='flex items-center justify-between'>
                    <StepMarker step="02" 
                                title="Choose your narrative arc." 
                                description="We've distilled your idea into three distinct directions. Select one to begin structuring your screenplay." 
                    />
                    <Button onClick={regenerateConcept} className='font-semibold' disabled={isGenerating}>
                        {isGenerating ? <IconLoader2 className='size-4 animate-spin' /> : <IconSparkles2 className='size-4' />}
                        {isGenerating ? 'Generating...' : 'Regenerate'}
                    </Button>
                </div>
                <Suspense fallback={<div>Loading...</div>}>
                    <RenderConcept projectId={projectId} />
                </Suspense>
            </Container>
        </div>
    )
}

function RenderConcept({projectId}: {projectId: string}){
    const { data } = useSuspenseQuery(getProjectQueryOptions(projectId))
    const { narrativeArcs, initialize, hasSelection } = useConceptStore(useShallow((state) => ({
        narrativeArcs: state.narrativeArcs,
        initialize: state.initialize,
        hasSelection: state.hasSelection,
    })))

    // Initialize store with data from server
    useEffect(() => {
        if (data?.narrative_arcs) {
            initialize(projectId, data.narrative_arcs, data.synopsis)
        }
    }, [projectId, data, initialize])

    const handleSubmit = () => {
        console.log('All arcs:', narrativeArcs)
    }

    if (!data) {
        return <div>Empty narrative arcs</div>
    }

    return (
        <>
            <div className='flex flex-col gap-4'>
                {narrativeArcs.map((_, index) => (
                    <ConceptCard key={index} index={index} />
                ))}
            </div>
            <div className={cn('fixed bottom-0 left-0 right-0 bg-background/10 backdrop-blur-2xl border-t translate-y-full transition-all duration-300', hasSelection() ? 'translate-y-0' : '')}>
                <Container className='flex items-center justify-end py-8 z-10'>
                    <Button className='font-bold capitalize' onClick={handleSubmit}>
                        Continue
                        <IconArrowNarrowRight className='size-4' />
                    </Button>
                </Container>
            </div>
        </>
    )
}


function ConceptCard({ index }: ConceptCardProps) {
    const [collapsed, setCollapsed] = useState(false)
    const { narrativeArcs, updateArc, selectArc, isGenerating } = useConceptStore()
    
    const arc = narrativeArcs[index]
    if (!arc) return null

    // Safely access properties with fallbacks for partial data during streaming
    const title = arc.title ?? ''
    const logline = arc.logline ?? ''
    const synopsis = arc.synopsis ?? ''
    const tone = arc.tone ?? []
    const isSelected = arc.isSelected ?? false

    const handleCollapse = (e: React.MouseEvent<HTMLButtonElement>) => {
        setCollapsed(!collapsed)
        e.stopPropagation()
    }

    const textAreaClass = 'focus-visible:ring-0 focus-visible:ring-offset-0 border-none p-0 resize-none w-full h-fit min-h-none bg-transparent!'

    return (
        <div className={cn('glass-panel group p-6 rounded-md', 'hover:border-primary/30! transition-all duration-300', isSelected && 'bg-primary/5! border-primary/30!')}>
            <div className='flex items-start justify-between'>
                <div className='flex-1'>
                    <input 
                        type='text' 
                        value={title} 
                        onChange={(e) => updateArc(index, { title: e.target.value })} 
                        className='text-xl font-semibold tracking-tight group-hover:scale-102 transition-transform duration-300 w-full'
                        placeholder='Title...'
                        readOnly={isGenerating}
                    />
                    <div className='flex items-center gap-2 text-primary'>
                        {tone.length > 0 ? tone.map((tag, i) => (
                            <React.Fragment key={tag ?? i}>
                                {i > 0 && <span>&bull;</span>}
                                <span className='text-[11px] uppercase tracking-widest'>{tag}</span>
                            </React.Fragment>
                        )) : (
                            <span className='text-[11px] uppercase tracking-widest text-muted-foreground'>Loading...</span>
                        )}
                    </div>
                </div>
                <div className='flex items-center gap-2'>
                    {isSelected && <IconCircleCheckFilled className='size-4 text-primary' />}
                    <Button 
                        className='font-semibold border-primary/30!' 
                        variant='outline'
                        onClick={() => selectArc(index)}
                        disabled={isGenerating}
                    >
                        {isSelected ? 'Picked' : 'Pick me'}
                    </Button>
                    <Button variant='ghost' size='icon' className='rounded-full hover:bg-primary/20!' onClick={handleCollapse}>
                        {collapsed ? <ChevronDownIcon className='size-4' /> : <ChevronUpIcon className='size-4' />}
                    </Button>
                </div>
            </div>
            <div className={cn('transition-all duration-300 space-y-4', collapsed ? 'max-h-0 overflow-hidden' : 'h-fit pt-4')}>
                <Textarea 
                    value={logline} 
                    onChange={(e) => updateArc(index, { logline: e.target.value })} 
                    className={cn('text-gray-300', textAreaClass)} 
                    placeholder='Logline...' 
                    readOnly={isGenerating}
                />
                <Textarea 
                    value={synopsis} 
                    onChange={(e) => updateArc(index, { synopsis: e.target.value })} 
                    className={cn('text-muted-foreground', textAreaClass)} 
                    placeholder='Summary...' 
                    readOnly={isGenerating}
                />
            </div>
        </div>
    )
}


