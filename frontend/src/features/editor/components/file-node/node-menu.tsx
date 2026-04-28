import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

type Props = {
    onChange: (action: string) => void;
    options: {
        icon: React.ReactNode
        label: string
        value: string
    }[]
}


export const FileNodeMenu = (props: Props) => {
    const { onChange, options } = props
    const handleClick = (action: string) => {
        return (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
            e.stopPropagation()
            onChange(action)
        }
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild
                                 onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                  }}
            >
                <button className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground">
                    <MoreHorizontal className="size-3.5" />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" side='bottom' className="min-w-[160px]" onCloseAutoFocus={(e) => e.preventDefault()}>
                {options.map((option) => (
                    <DropdownMenuItem key={option.value} onClick={handleClick(option.value)}>
                        {option.icon ?? null}
                        {option.label}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}