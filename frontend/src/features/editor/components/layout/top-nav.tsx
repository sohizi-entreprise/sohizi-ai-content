import {
  ChevronDown,
  Undo2,
  Redo2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function TopNav() {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary">
            <span className="text-xs font-bold text-primary-foreground">S</span>
          </div>
          <span className="text-sm font-semibold text-foreground">Sohizi AI</span>
        </div>

        <span className="text-muted-foreground/40">|</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground">
              <span className="text-xs">Untitled Project</span>
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Episode 1 - Pilot</DropdownMenuItem>
            <DropdownMenuItem>Episode 2 - The Chase</DropdownMenuItem>
            <DropdownMenuItem>New Project...</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
            <Undo2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground">
            <Redo2 className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Users className="size-3.5" />
          <span>Invite</span>
        </Button>

        <ThemeToggle />

        <div className="size-7 rounded-full bg-primary/20 ring-2 ring-primary/40 flex items-center justify-center">
          <span className="text-xs font-medium text-primary">JD</span>
        </div>
      </div>
    </header>
  )
}
