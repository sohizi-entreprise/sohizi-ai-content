import { ProjectToneOption, ProjectAudienceOption, ProjectDurationOption } from '../type'
import { useNewProjectStore } from '../store/new-project-store'
import { Slider } from '@/components/ui/slider'

type ProjectSettingsProps = {
    duration: ProjectDurationOption
    tones: ProjectToneOption[]
    audiences: ProjectAudienceOption[]
}

export default function ProjectSettings({ duration, tones, audiences }: ProjectSettingsProps) {
    return (
        <>
            <DurationSelector duration={duration} />
            <div className='grid grid-cols-2 gap-4'>
                <ToneSelector tones={tones} />
                <AudienceSelector audiences={audiences} />
            </div>
        </>
    )
}

function DurationSelector({ duration }: { duration: ProjectDurationOption }) {
    const { duration: selectedDuration, setDuration } = useNewProjectStore()
    
    const getIntervalRange = (min: number, max: number, count: number): number[] => {
        const range = max - min
        const interval = range / (count + 1)
        const values: number[] = []
        for (let i = 1; i <= count; i++) {
            const value = min + i * interval
            values.push(Math.round(value))
        }
        return values
    }

    return (
        <div className='glass-panel p-6 rounded-2xl space-y-4'>
            <SectionTitle number={3} label="Script duration" />
            <div className="space-y-6">
                <div className="flex justify-between text-xs text-gray-500 font-mono uppercase tracking-wide px-1">
                    <span>{duration.min} MIN</span>
                    {getIntervalRange(duration.min, duration.max, 3).map((value) => (
                        <span key={value}>{value} MIN</span>
                    ))}
                    <span>{duration.max} MIN</span>
                </div>
                <div className="relative">
                    <Slider 
                        className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
                        max={duration.max} 
                        min={duration.min} 
                        step={1}
                        value={[selectedDuration]}
                        onValueChange={(value) => setDuration(value[0])}
                    />
                    <div className="mt-4 flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-medium">{selectedDuration} minutes</span>
                        <span className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">~{Math.round(selectedDuration * 1)} pages</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ToneSelector({ tones }: { tones: ProjectToneOption[] }) {
    const { tones: selectedTones, toggleTone } = useNewProjectStore()

    return (
        <div className='glass-panel p-6 rounded-2xl space-y-4'>
            <SectionTitle number={4} label="Atmospheric tone" subtitle="( select multiple )" />
            <div className='grid grid-cols-3 gap-2'>
                {tones.map((tone) => {
                    const isSelected = selectedTones.includes(tone.id)
                    return (
                        <button 
                            key={tone.id} 
                            onClick={() => toggleTone(tone.id)}
                            className={`relative group p-2 rounded-lg backdrop-blur-md border transition-all flex items-center justify-between ${
                                isSelected 
                                    ? 'bg-primary/5 border-primary text-white' 
                                    : 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/5'
                            }`}
                        >
                            <span className={`size-3 rounded-[2px] border transition-colors flex items-center justify-center ${
                                isSelected 
                                    ? 'bg-primary border-primary' 
                                    : 'border-white/20'
                            }`}>
                                
                            </span>
                            <span className={`text-sm capitalize transition-colors mx-auto ${
                                isSelected 
                                    ? 'text-white' 
                                    : 'text-gray-500 group-hover:text-white'
                            }`}>{tone.name}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function AudienceSelector({ audiences }: { audiences: ProjectAudienceOption[] }) {
    const { audience: selectedAudience, setAudience } = useNewProjectStore()

    return (
        <div className='glass-panel p-6 rounded-2xl space-y-4'>
            <SectionTitle number={5} label="Target audience" subtitle="( select one )" />
            <div className='grid grid-cols-3 gap-2'>
                {audiences.map((audience) => {
                    const isSelected = selectedAudience === audience.id
                    return (
                        <button 
                            key={audience.id} 
                            onClick={() => setAudience(audience.id)}
                            className={`group flex items-center justify-between p-2 rounded-lg backdrop-blur-md border transition-all ${
                                isSelected 
                                    ? 'bg-primary/5 border-primary text-white' 
                                    : 'bg-white/5 border-white/10 hover:border-primary/50 hover:bg-white/5'
                            }`}
                        >
                            <span className={`size-3 inline-block rounded-full border transition-colors ${
                                isSelected 
                                    ? 'bg-primary border-primary' 
                                    : 'border-white/20'
                            }`}/>
                            <span className={`text-sm capitalize transition-colors mx-auto ${
                                isSelected 
                                    ? 'text-white' 
                                    : 'text-muted-foreground group-hover:text-white'
                            }`}>{audience.name}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function SectionTitle({ number, label, subtitle }: { number: number; label: string; subtitle?: string }) {
    return (
        <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-3">
            <span className="bg-white/5 text-primary size-6 rounded-full flex items-center justify-center text-sm border border-white/10">{number}</span>
            {label}
            {subtitle && <span className="text-xs text-gray-500 font-normal">{subtitle}</span>}
        </h2>
    )
}
