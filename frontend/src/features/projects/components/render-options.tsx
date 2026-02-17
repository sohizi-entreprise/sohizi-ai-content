import { cn } from "@/lib/utils"
import { ClassValue } from "clsx"
import { ReactNode } from "react"

type ItemType = {
    value: string
    label: string
    icon: ReactNode
    onClick: () => void
}

type RenderOptionsProps = {
    data: Omit<ItemType, 'onClick'>[]
    onSelect?: (value: string) => void
    className?: ClassValue
}

export default function RenderOptions({data, onSelect, className}: RenderOptionsProps) {

    return (
        <div className={cn('flex gap-4', className)}>
            {
                data.map((format) => (
                    <OptionItem key={format.value} {...format} onClick={() => onSelect?.(format.value)} />
                ))
            }
        </div>
    )
}

function OptionItem(props: ItemType){
    const {onClick, label, icon} = props

    return (
        <button onClick={onClick} 
                className="p-3 gap-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 hover:border-primary/50 hover:bg-white/5 transition-all group flex flex-col items-center justify-center text-center h-30 aspect-square">
            {icon}
            <span className="text-sm font-medium text-gray-300 group-hover:text-white">{label}</span>
        </button>
    )
}
