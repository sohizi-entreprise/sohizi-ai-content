import { cn } from "@/lib/utils"
import { ClassValue } from "clsx"
import { ForwardRefExoticComponent, RefAttributes } from "react"
import { IconBook, IconBulb, IconSwipe, IconPresentation, IconProps } from "@tabler/icons-react"


type ItemType = {
    id: string
    name: string
    description: string
    isSelected: boolean
    onClick: () => void
}

type RenderFormatProps = {
    data: Omit<ItemType, 'onClick' | 'isSelected'>[]
    selectedId?: string | null
    onSelect?: (value: string) => void
    className?: ClassValue
}

export default function RenderFormat({data, selectedId, onSelect, className}: RenderFormatProps) {

    return (
        <div className={cn('flex gap-4', className)}>
            {
                data.map((format) => (
                    <FormatItem 
                        key={format.id} 
                        {...format} 
                        isSelected={selectedId === format.id}
                        onClick={() => onSelect?.(format.id)} 
                    />
                ))
            }
        </div>
    )
}

function FormatItem(props: ItemType){
    const {onClick, name, id, isSelected} = props
    const Icon = getIconsMap()[id] ?? IconBook

    return (
        <button onClick={onClick} 
                className={cn(
                    "p-3 gap-1 rounded-xl backdrop-blur-md border transition-all group flex flex-col items-center justify-center text-center h-30 aspect-square relative",
                    isSelected 
                        ? "bg-primary/5 border-primary" 
                        : "bg-white/5 border-white/5 hover:border-primary/50 hover:bg-white/5"
                )}>
            {isSelected && (
                <div className="absolute top-2 right-2 size-2 bg-primary rounded-full flex items-center justify-center" />
            )}
            <Icon className={cn('size-5 transition-colors', isSelected ? 'text-primary' : 'group-hover:text-primary')} />
            <span className={cn("text-sm font-medium", isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white')}>{name}</span>
        </button>
    )
}

function getIconsMap(): Record<string, ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>>{
    return {
        storytime: IconBook,
        explainer: IconBulb,
        documentary: IconSwipe,
        presenter: IconPresentation,
    }
}
