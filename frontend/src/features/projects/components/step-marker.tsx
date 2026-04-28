
type Props = {
  step: string
  title: string
  description?: string
  className?: string
}

export default function StepMarker({step, title, description, className}: Props) {
  return (
    <div className={className}>
        <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-8 bg-primary/40"></span>
            <span className="text-[11px] font-bold text-primary uppercase tracking-[0.3em]">Step {step}</span>
        </div>
        <h1 className='text-4xl font-bold tracking-tight mb-2'>{title}</h1>
        {description && <p className='text-muted-foreground leading-relaxed'>{description}</p>}
    </div>
  )
}
