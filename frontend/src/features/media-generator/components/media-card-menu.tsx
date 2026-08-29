import { useState } from 'react'
import { MoreVertical } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type MediaCardMenuOption = {
  label: string
  icon: LucideIcon
  onClick: () => void
}

type MediaCardMenuProps = {
  className?: string
  options: Array<MediaCardMenuOption>
}

export function MediaCardMenu({ className, options }: MediaCardMenuProps) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            'rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white',
            className,
          )}
          aria-label="Media actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-white/10 bg-black/90 text-white backdrop-blur-xl"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.label}
            onSelect={() => {
              setOpen(false)
              option.onClick()
            }}
          >
            <option.icon className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
