import {
    Files,
    Play
  } from 'lucide-react'
  import { cn } from '@/lib/utils'
  import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
  } from '@/components/ui/tooltip'
  import { useEditorStore } from '@/features/editor/stores/editor-store'
  import { Link, useParams } from '@tanstack/react-router'
  
  const ITEMS = [
    { id: 'files', icon: Files, label: 'Explorer', link: '/dashboard/projects/$projectId/editor' },
    { id: 'media-generator', icon: Play, label: 'AI media generator', link: '/dashboard/projects/$projectId/generate' },
  ] as const
  
  type ActivityBarItem = (typeof ITEMS)[number]['id']
  
  export function AppNavBar() {
    const active = useEditorStore((s) => s.activityBarItem)
    const setActive = useEditorStore((s) => s.setActivityBarItem)
    const toggleSidebar = useEditorStore((s) => s.toggleSidebar)
  
    const {projectId} = useParams({from: '/dashboard/projects/$projectId'})
  
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
      <div className="flex w-12 shrink-0 flex-col items-center justify-between py-2 backdrop-blur-md">
        <div className="flex flex-col items-center gap-4">
          {ITEMS.map(({ id, icon: Icon, label, link }) => (
            <Link
              key={id}
              from="/dashboard/projects/$projectId"
              to={link}
              params={{ projectId }}
              onClick={() => handleClick(id)}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'flex size-9 items-center justify-center rounded-md transition-colors',
                      active === id
                        ? 'text-primary'
                        : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground',
                    )}
                  >
                    <Icon className="size-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            </Link>
          ))}
        </div>
  
        <div className="flex flex-col items-center gap-1">
          <Tooltip>
            <TooltipTrigger>
              <div className="size-7 rounded-full bg-primary/20 ring-2 ring-primary/40 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">JD</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    )
  }