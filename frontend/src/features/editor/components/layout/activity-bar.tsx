import {
  Files,
  Search,
  GitBranch,
  Play,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { useEditorStore } from '../../stores/editor-store'
import type { ActivityBarItem } from '../../types'

const ITEMS: { id: ActivityBarItem; icon: typeof Files; label: string }[] = [
  { id: 'files', icon: Files, label: 'Explorer' },
  { id: 'search', icon: Search, label: 'Search' },
  { id: 'git', icon: GitBranch, label: 'Source Control' },
  { id: 'extensions', icon: Play, label: 'Run & Debug' },
]

export function ActivityBar() {
  const active = useEditorStore((s) => s.activityBarItem)
  const setActive = useEditorStore((s) => s.setActivityBarItem)
  const toggleSidebar = useEditorStore((s) => s.toggleSidebar)

  const handleClick = (id: ActivityBarItem) => {
    if (active === id) {
      toggleSidebar()
    } else {
      setActive(id)
      const { sidebarCollapsed } = useEditorStore.getState()
      if (sidebarCollapsed) toggleSidebar()
    }
  }

  return (
    <div className="flex w-12 shrink-0 flex-col items-center justify-between border-r border-border/50 bg-background/30 py-2 backdrop-blur-md">
      <div className="flex flex-col items-center gap-1">
        {ITEMS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleClick(id)}
                className={cn(
                  'flex size-9 items-center justify-center rounded-md transition-colors',
                  active === id
                    ? 'bg-accent/50 text-foreground'
                    : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
                )}
              >
                <Icon className="size-[18px]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleClick('settings')}
              className={cn(
                'flex size-9 items-center justify-center rounded-md transition-colors',
                active === 'settings'
                  ? 'bg-accent/50 text-foreground'
                  : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
              )}
            >
              <Settings className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
