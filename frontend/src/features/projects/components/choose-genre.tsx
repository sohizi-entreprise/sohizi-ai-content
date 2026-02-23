import { 
    IconBolt, 
    IconMasksTheater, 
    IconMoodSmile, 
    IconRocket, 
    IconSkull,
    IconHeart,
    IconWand,
    IconSearch,
    IconMovie,
    IconProps,
} from '@tabler/icons-react'
import { ForwardRefExoticComponent, RefAttributes, useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

type GenreItemType = {
    id: string
    name: string
    description: string
    image: string
    isSelected: boolean
    onClick: () => void
}

type GenreProps = {
    data: Omit<GenreItemType, 'onClick' | 'isSelected'>[]
    selectedId?: string | null
    onSelect?: (value: string) => void
}


export default function ChooseGenre(props: GenreProps) {
    const { data, selectedId, onSelect } = props
    const scrollRef = useRef<HTMLDivElement>(null)
    const [showLeftFade, setShowLeftFade] = useState(false)
    const [showRightFade, setShowRightFade] = useState(false)

    useEffect(() => {
        const el = scrollRef.current
        if (!el) return

        const updateFades = () => {
            const { scrollLeft, scrollWidth, clientWidth } = el
            setShowLeftFade(scrollLeft > 0)
            setShowRightFade(scrollLeft + clientWidth < scrollWidth - 1)
        }

        updateFades()
        el.addEventListener('scroll', updateFades)
        window.addEventListener('resize', updateFades)

        return () => {
            el.removeEventListener('scroll', updateFades)
            window.removeEventListener('resize', updateFades)
        }
    }, [data])

  return (
    <div className="relative">
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {
                data.map((genre) => (
                    <GenreItem 
                        key={genre.id} 
                        {...genre} 
                        isSelected={selectedId === genre.id}
                        onClick={() => onSelect?.(genre.id)} 
                    />
                ))
            }
        </div>
        {/* Left fade overlay */}
        <div className={`absolute left-0 top-0 bottom-2 w-24 bg-linear-to-r from-background to-transparent pointer-events-none transition-opacity duration-300 ${showLeftFade ? 'opacity-100' : 'opacity-0'}`} />
        {/* Right fade overlay */}
        <div className={`absolute right-0 top-0 bottom-2 w-24 bg-linear-to-l from-background to-transparent pointer-events-none transition-opacity duration-300 ${showRightFade ? 'opacity-100' : 'opacity-0'}`} />
    </div>
  )
}

function GenreItem(props: GenreItemType){
    const { name, id, image, isSelected, onClick } = props
    const Icon = getGenreIconsMap()[id] ?? IconMovie

    return (
        <button 
            onClick={onClick} 
            className={cn(
                "group shrink-0 relative w-40 aspect-3/4 rounded-xl overflow-hidden border transition-all bg-surface-dark",
                isSelected 
                    ? "border-primary" 
                    : "border-white/10 hover:border-primary/50"
            )}
        >
            <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent z-10"></div>
            <img alt={name} className={cn(
                "absolute inset-0 w-full h-full object-cover transition-transform duration-500",
                isSelected ? "scale-110 opacity-100" : "opacity-80 group-hover:scale-110 group-hover:opacity-100"
            )} src={image}/>
            <div className="absolute bottom-4 left-4 z-20 text-left">
                <Icon className="text-primary size-5" />
                <h3 className="font-semibold text-white">{name}</h3>
            </div>
            <div className={cn(
                "absolute top-2 right-2 size-2 bg-primary rounded-full transition-opacity",
                isSelected ? "opacity-100" : "opacity-0"
            )} 
            />
                
        </button>
    )
}

function getGenreIconsMap(): Record<string, ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>> {
    return {
        drama: IconMasksTheater,
        comedy: IconMoodSmile,
        thriller: IconSkull,
        horror: IconSkull,
        romance: IconHeart,
        'sci-fi': IconRocket,
        fantasy: IconWand,
        action: IconBolt,
        mystery: IconSearch,
        documentary: IconMovie,
    }
}