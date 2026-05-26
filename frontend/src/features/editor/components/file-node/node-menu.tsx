import { MoreHorizontal } from 'lucide-react'
import type { FileNodeFormat } from '../../types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export const FILE_FORMAT_OPTIONS: Array<{
  label: string
  value: FileNodeFormat
}> = [
  { label: 'Default', value: 'markdown' },
  { label: 'Skill', value: 'skill' },
]

type Props = {
  onChange: (action: string) => void
  options: Array<{
    icon: React.ReactNode
    label: string
    value: string
  }>
  children?: React.ReactNode
}

export const FileNodeMenu = (props: Props) => {
  const { onChange, options, children } = props
  const handleClick = (action: string) => {
    return (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      e.stopPropagation()
      onChange(action)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        asChild
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        {children ? (
          children
        ) : (
          <button
            type="button"
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
          >
            <MoreHorizontal className="size-3.5" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        className="min-w-[160px]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={handleClick(option.value)}
          >
            {option.icon ?? null}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
