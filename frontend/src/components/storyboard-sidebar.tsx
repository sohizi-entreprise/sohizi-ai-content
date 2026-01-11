import { Link, useParams } from '@tanstack/react-router'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  FileText,
  Users,
  LayoutGrid,
  Boxes,
  Settings,
} from 'lucide-react'

// Navigation items for the sidebar
const navItems = [
  {
    id: 'script',
    label: 'Script',
    description: 'Display the full script so users can read the entire story',
    icon: FileText,
    path: 'script',
  },
  {
    id: 'characters',
    label: 'Characters',
    description: 'Show a list of all characters in the scene',
    icon: Users,
    path: 'characters',
  },
  {
    id: 'storyboard',
    label: 'Storyboard',
    description: 'Navigate to the storyboard page',
    icon: LayoutGrid,
    path: 'storyboard',
  },
  {
    id: 'elements',
    label: 'Elements',
    description: 'Display locations, costumes, props, and other important scenario elements',
    icon: Boxes,
    path: 'elements',
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Configure project settings',
    icon: Settings,
    path: 'settings',
  },
] as const

export type NavItemId = (typeof navItems)[number]['id']

interface StoryboardSidebarProps {
  activeNav: NavItemId
}

export function StoryboardSidebar({ activeNav }: StoryboardSidebarProps) {
  const { projectId } = useParams({ strict: false }) as { projectId: string }

  return (
    <TooltipProvider delayDuration={100}>
      <nav
        className="storyboard-sidebar floating-glass-nav fixed left-4 top-1/2 z-40 -translate-y-1/2 p-2"
        role="navigation"
        aria-label="Storyboard navigation"
      >
        {/* Navigation items */}
        <div className="relative z-10 flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeNav === item.id
            
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <Link
                    to={`/projects/$projectId/${item.path}`}
                    params={{ projectId }}
                    className={`
                      sidebar-nav-item group relative flex h-11 w-11 items-center justify-center rounded-xl
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                      ${isActive 
                        ? 'bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 text-violet-300 shadow-lg shadow-violet-500/20' 
                        : 'text-white/60 hover:bg-white/[0.08] hover:text-white'
                      }
                    `}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {/* Active indicator dot */}
                    {isActive && (
                      <span className="absolute -right-0.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 shadow-lg shadow-violet-500/50" />
                    )}
                    
                    {/* Icon */}
                    <Icon className={`
                      lucide h-5 w-5
                      ${isActive ? 'drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]' : ''}
                    `} />
                    
                    {/* Hover glow overlay */}
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-500/0 to-fuchsia-500/0 opacity-0 transition-opacity duration-300 group-hover:from-violet-500/10 group-hover:to-fuchsia-500/10 group-hover:opacity-100" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  sideOffset={16}
                  className="border-white/10 bg-black/90 px-3 py-2 backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-white">{item.label}</span>
                    <span className="text-xs text-white/60">{item.description}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </nav>
    </TooltipProvider>
  )
}

