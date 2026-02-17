import Container from '@/components/layout/container'
import ChooseGenre from '../components/choose-genre';
import RenderOptions from '../components/render-options';
import { IconBook, IconBulb, IconPresentation, IconSwipe } from '@tabler/icons-react'
import BriefInput from '../components/brief-input';
import StepMarker from '../components/step-marker';
import NewProjectHeader from '../components/new-project-header';
import { useNavigate } from '@tanstack/react-router';

export default function NewProject() {

    const navigate = useNavigate()
    const onSumbit = (_prompt: string) => {
        const projectId = crypto.randomUUID()
        navigate({
            to: '/dashboard/projects/$projectId/concept',
            params: {
                projectId,
            },
        })
    }
  return (
    <div>
        <NewProjectHeader currentStep="brief" />

        <Container className='pt-8 pb-16 space-y-8'>
            <StepMarker step="01" title="Let's start" description="Every masterpiece begins with a simple thought. Describe yours in detail or just a few sentences." />

            <div className='space-y-4 glass-panel p-6 rounded-2xl'>
                <SectionTitle number={1} label="Pick Your Format" />
                <RenderOptions data={getFormats()} onSelect={() => {}} />
            </div>

            <div className='space-y-4'>
                <SectionTitle number={2} label="Choose Your Genre" />
                <ChooseGenre onSelect={() => {}} />
            </div>

            <div className='glass-panel p-6 rounded-2xl space-y-4'>
                <SectionTitle number={3} label="Script duration" />
                <div className="space-y-6">
                    <div className="flex justify-between text-xs text-gray-500 font-mono uppercase tracking-wide px-1">
                        <span>1 MIN</span>
                        <span>6 MIN</span>
                        <span>11 MIN</span>
                        <span>16 Min</span>
                    </div>
                    <div className="relative px-2">
                        <input className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer" max="16" min="1" step="1" type="range" onChange={(e)=> console.log(e.target.value)}/>
                        <div className="mt-4 flex justify-end items-center">
                            <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">~120 pages</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
                <div className='glass-panel p-6 rounded-2xl space-y-4'>
                    <SectionTitle number={4} label="Atmospheric tone" />
                    <div className='grid grid-cols-3 gap-2'>
                        {
                            getTones().map((tone) => (
                                <button key={tone} className='relative group p-2 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 hover:border-primary/50 hover:bg-white/5 transition-all flex items-center justify-between'>
                                    <span className='size-3 inline-block rounded-[2px] border border-white/20'/>
                                    <span className='text-sm text-gray-500 capitalize group-hover:text-white transition-colors mx-auto'>{tone}</span>
                                </button>
                            ))
                        }
                    </div>
                </div>
                <div className='glass-panel p-6 rounded-2xl space-y-4'>
                    <SectionTitle number={5} label="Target audience" />
                    <div className='grid grid-cols-3 gap-2'>
                        {
                            getAudiences().map((tone) => (
                                <button key={tone} className='group flex items-center justify-between p-2 rounded-lg bg-white/5 backdrop-blur-md border border-white/10 hover:border-primary/50 hover:bg-white/5 transition-all'>
                                    <span className='size-3 inline-block rounded-full border border-white/20'/>
                                    <span className='text-sm text-muted-foreground capitalize group-hover:text-white transition-colors mx-auto'>{tone}</span>
                                </button>
                            ))
                        }
                    </div>
                </div>
                
            </div>

            <div className='space-y-4'>
                <SectionTitle number={6} label="Describe your core idea or premise" />
                <BriefInput onSubmit={onSumbit} 
                />
            </div>

        </Container>
    </div>
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

function getFormats(){
    const iconClassName = 'size-5 group-hover:text-primary transition-colors'

    return [
        {
            value: 'storytime',
            label: 'Story Time',
            icon: <IconBook className={iconClassName}/>,
        },
        {
            value: 'explainer',
            label: 'Explainer',
            icon: <IconBulb className={iconClassName}/>,
        },
        {
            value: 'documentary',
            label: 'Documentary',
            icon: <IconSwipe className={iconClassName}/>,
        },
        {
            value: 'presenter',
            label: 'Presenter',
            icon: <IconPresentation className={iconClassName}/>,
        },
    ]
}

function getTones(){
    return [
        'inspirational',
        'dramatic',
        'comedic',
        'educational',
        'mysterious',
        'thrilling',
        'dark',
        'romantic',
        'futuristic',
    ]
}

function getAudiences(){
    return [
        'general',
        'kids',
        'teens',
        'adults(16+)',
    ]
}