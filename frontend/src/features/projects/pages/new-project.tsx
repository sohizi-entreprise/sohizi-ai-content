import Container from '@/components/layout/container'
import ChooseGenre from '../components/choose-genre';
import RenderFormat from '../components/render-format';
import BriefInput from '../components/brief-input';
import StepMarker from '../components/step-marker';
import NewProjectHeader from '../components/new-project-header';
import ProjectSettings from '../components/project-settings';
import { useNavigate } from '@tanstack/react-router';
import { createProjectMutationOptions, getProjectOptionsQueryOptions } from '../query-mutation';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { useNewProjectStore } from '../store/new-project-store';
import { toast } from 'sonner';
import { Suspense, useEffect } from 'react';
import { CreateProjectInput } from '../type';

export default function NewProject() {
  const reset = useNewProjectStore((state) => state.reset)

  // Reset store when component mounts
  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div>
        <NewProjectHeader currentStep="brief" />

        <Container className='pt-8 pb-16 space-y-8'>
            <StepMarker step="01" title="Let's start" description="Every masterpiece begins with a simple thought. Describe yours in detail or just a few sentences." />
            <Suspense fallback={<div>Loading...</div>}>
                <RenderProjectOptions />
            </Suspense>
        </Container>
    </div>
  )
}

function RenderProjectOptions(){
    const navigate = useNavigate()
    const { data } = useSuspenseQuery(getProjectOptionsQueryOptions)
    const {mutate: createProject, isPending: isCreatingProject} = useMutation(createProjectMutationOptions)
    
    const { 
        format, 
        genre, 
        setFormat, 
        setGenre,
        setStoryIdea,
        validate 
    } = useNewProjectStore()

    const onSubmit = async (storyIdea: string) => {
        // Update story idea in store
        setStoryIdea(storyIdea)
        
        // Validate all fields
        const { valid, errors } = validate()
        
        if (!valid) {
            // Show all errors as toasts
            errors.forEach((error) => {
                toast.error(error, {
                    position: 'top-center',
                })
            })
            return
        }

        // Create project via API
        const state = useNewProjectStore.getState()
        const payload: CreateProjectInput = {
            title: 'Untitled Project',
            brief: {
                format: state.format!,
                genre: state.genre!,
                durationMin: state.duration,
                tone: state.tones,
                audience: state.audience!,
                storyIdea: state.storyIdea,
            }
        }
        createProject(
            payload,
            {
                onSuccess: (response) => {
                    toast.success('Project created successfully!', {
                        position: 'top-center',
                    })
                    navigate({
                        to: '/dashboard/projects/$projectId/concept',
                        params: {
                            projectId: response.project.id,
                        },
                    })
                },
                onError: (error) => {
                    console.error(error)
                    toast.error('Failed to create project. Please try again.', {
                        position: 'top-center',
                    })
                }
            }
        )
    }

    return (
        <>
        <div className='space-y-4 glass-panel p-6 rounded-2xl'>
            <SectionTitle number={1} label="Pick Your Format" />
            <RenderFormat 
                data={data.formats} 
                selectedId={format}
                onSelect={setFormat} 
            />
        </div>

        <div className='space-y-4'>
            <SectionTitle number={2} label="Choose Your Genre" />
            <ChooseGenre 
                data={data.genres}
                selectedId={genre}
                onSelect={setGenre}
            />
        </div>

        <ProjectSettings 
            duration={data.duration}
            tones={data.tones}
            audiences={data.audiences}
        />

        <div className='space-y-4'>
            <SectionTitle number={6} label="Describe your core idea or premise" />
            <BriefInput 
                onSubmit={onSubmit}
                isLoading={isCreatingProject}
            />
        </div>
        </>

    )
}

function SectionTitle(props: {number: number; label: string}) {

    return (
    <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-3">
    <span className="bg-white/5 text-primary size-6 rounded-full flex items-center justify-center text-sm border border-white/10">{props.number}</span>
        {props.label}
    </h2>
    )
}