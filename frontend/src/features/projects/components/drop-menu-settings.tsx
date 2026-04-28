import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export type DropMenuOption = {
    label: string
    value: string
    icon?: React.ReactNode
}

type Props = {
    children: React.ReactNode
    options: DropMenuOption[]
    onSelect: (value: string) => void
    align?: "start" | "center" | "end"
}

export default function DropMenuSettings({children, options, onSelect, align = "start"}: Props) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align} 
                                 className="w-56 border-white/10 bg-black/90 backdrop-blur-xl"
            >
                {options.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={() => onSelect(option.value)}>
                        {option.icon ?? null}
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}