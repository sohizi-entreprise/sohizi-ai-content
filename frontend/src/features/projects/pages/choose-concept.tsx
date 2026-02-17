import NewProjectHeader from '../components/new-project-header'
import Container from '@/components/layout/container'
import StepMarker from '../components/step-marker'
import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { IconCircleCheckFilled, IconCircleMinus, IconCirclePlus, IconWritingSign } from '@tabler/icons-react'
import { Textarea } from '@/components/ui/textarea'

type ConceptCardProps = {
    title: string;
    description: string;
    tags: string[];
    onClick: () => void;
    isActive: boolean;

}

export default function ChooseConcept() {
    const [selectedConcept, setSelectedConcept] = useState<string | null>(null)
  return (
    <div>
        <NewProjectHeader currentStep="concepts" />
        <Container className='pt-8 pb-[140px] space-y-8'>
            <StepMarker step="02" 
                        title="Choose your narrative arc." 
                        description="We've distilled your idea into three distinct directions. Select one to begin structuring your screenplay." 
            />
            <div className='flex flex-col gap-4'>
                {getConcepts().map((concept) => (
                    <ConceptCard key={concept.title} {...concept} onClick={() => setSelectedConcept(concept.title)} isActive={selectedConcept === concept.title} />
                ))}

                <div className='h-px w-full bg-white/10 mt-4'/>
                <OwnPath />
            </div>
        </Container>

        <div className={cn('fixed bottom-0 left-0 right-0 bg-background/10 backdrop-blur-2xl border-t translate-y-full transition-all duration-300', selectedConcept ? 'translate-y-0' : '')}>
            <Container className='flex items-center justify-between py-8 z-10'>
                <div>
                    <p className='text-white line-clamp-1 max-w-[200px]'>
                        {selectedConcept}
                    </p>
                </div>
                <Button className='font-bold capitalize rounded-full'>
                    Start writing
                    <IconWritingSign className='size-5' />
                </Button>
            </Container>
        </div>
    </div>
  )
}


function ConceptCard({title, description, tags, onClick, isActive}: ConceptCardProps) {
    const [collapsed, setCollapsed] = useState(false)
    const handleCollapse = (e: React.MouseEvent<HTMLButtonElement>) =>{
        setCollapsed(!collapsed)
        e.stopPropagation()
    }
  return (
    <div className={cn('glass-panel group p-6 rounded-2xl cursor-pointer', 'hover:border-primary/30! transition-all duration-300', isActive && 'bg-primary/5! border-primary/30!')}
         onClick={onClick}
    >
        <div className='flex items-start justify-between'>
            <div>
                <h2 className='text-xl font-semibold tracking-tight group-hover:scale-102 transition-transform duration-300'>{title}</h2>
                <div className='flex items-center gap-2 text-primary'>
                    {tags.map((tag, index) => (
                        <React.Fragment key={tag}>
                        {index > 0 && <span>&bull;</span>}
                        <span key={tag} className='text-[11px] uppercase tracking-widest'>{tag}</span>
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div className='flex items-center gap-2'>
                {isActive && <IconCircleCheckFilled className='size-4 text-primary' />}
                <Button variant='ghost' size='icon' className='rounded-full hover:bg-primary/20!' onClick={handleCollapse}>
                    {collapsed ? <ChevronDownIcon className='size-4' /> : <ChevronUpIcon className='size-4' />}
                </Button>
            </div>
        </div>
        <div className={cn('transition-all duration-300', collapsed ? 'max-h-0 overflow-hidden' : 'h-fit pt-4')}>
            <p className={cn('text-muted-foreground', isActive && 'text-white/80')}>{description}</p>
        </div>
    </div>
  )
}

function OwnPath(){
    const [isOpen, setIsOpen] = useState(false)
    const [text, setText] = useState('')

    const handleClick = () => {
        setIsOpen(!isOpen)
    }

    return (
        <div className=''>
            <Button variant='ghost' onClick={handleClick} className='text-muted-foreground cursor-pointer hover:bg-transparent! hover:text-white'>
                {
                    isOpen ? <IconCircleMinus className='size-5'/> : <IconCirclePlus className='size-5'/>
                }
                Suggest your own path or improvements on a selected concept

            </Button>
            <div className={cn('flex items-center justify-between mt-4 transition-all duration-300', isOpen ? 'h-fit' : 'max-h-0 overflow-hidden')}>
                <div className='glass-panel rounded-2xl w-full'>
                    <Textarea
                            placeholder="Enter a new narrative arc or improve an existing one ..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="min-h-[140px] resize-none border-0 bg-transparent! p-6 text-base text-white placeholder:text-muted-foreground focus-visible:ring-0"
                    />
                </div>
            </div>
        </div>
    )
}

function getConcepts() {
  return [
    {
      title: 'The Hero\'s Journey',
      description: 'The hero\'s journey is a classic narrative arc that follows the hero\'s quest to achieve their goal.',
      tags: ['drama', 'romance'],
    },
    {
      title: 'Corporate Espionage',
      description: 'The hero\'s journey is a classic narrative arc that follows the hero\'s quest to achieve their goal.',
      tags: ['comedy', 'action'],
    },
    {
      title: 'Supernatural Thriller',
      description: 'The hero\'s journey is a classic narrative arc that follows the hero\'s quest to achieve their goal. The hero\'s journey is a classic narrative arc that follows the hero\'s quest to achieve their goal.',
      tags: ['horror', 'mystery'],
    },
  ]
}
