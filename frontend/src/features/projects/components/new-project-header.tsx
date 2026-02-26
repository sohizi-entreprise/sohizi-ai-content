import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClassValue } from 'clsx';

type Props = {
    currentStep: 'brief' | 'concepts' | 'drafting';
    className?: ClassValue;
}

export default function NewProjectHeader({ currentStep, className }: Props) {

  return (
    <div className={cn('grid grid-cols-3 gap-4 border-b border-white/10 px-8 h-header sticky top-0 bg-background/80 backdrop-blur-2xl z-50', className)}>
        <div className='flex items-center gap-2 text-muted-foreground'>
            <Link to="/dashboard/main/projects">
                <span className='text-muted-foreground text-sm hover:text-white transition-colors cursor-pointer'>Projects</span>
            </Link>
            <span>
                <ChevronRight className='size-3' />
            </span>
            <span className='text-sm text-primary'>New project</span>
        </div>

        <div className="hidden md:flex items-center space-x-8 place-self-center text-muted-foreground">
            <Step step="brief" isActive={currentStep === 'brief'} />
            <Step step="concepts" isActive={currentStep === 'concepts'} />
            <Step step="drafting" isActive={currentStep === 'drafting'} />
        </div>

    </div>
  )
}

function Step({ step, isActive }: { step: 'brief' | 'concepts' | 'drafting'; isActive: boolean }) {
  return (
    <div className="flex items-center space-x-2">
      <span className={cn("text-[11px] uppercase tracking-widest", isActive ? 'text-primary' : 'text-muted-foreground')}>{step}</span>
      <div className={cn("h-1 w-1 rounded-full bg-primary hidden", isActive && 'block')}/>
    </div>
  )
}