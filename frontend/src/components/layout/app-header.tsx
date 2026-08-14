import {
    ChevronDown,
  } from 'lucide-react'
  import { Button } from '@/components/ui/button'
  import { ThemeToggle } from '@/components/theme-toggle'
  import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
  import { useSuspenseInfiniteQuery } from '@tanstack/react-query'
  import { getListProjectsQueryOptions } from '@/features/projects/query-mutation'
  import { Suspense, useState } from 'react'
  import { Skeleton } from '@/components/ui/skeleton'
  import { Link, useRouterState } from '@tanstack/react-router'
  import { IconFocus2, IconSparkle, IconX } from '@tabler/icons-react'
  import { useSession } from '@/lib/auth-client'
import {
  getChatChromeContext,
  useEditorStore,
} from '@/features/editor/stores/editor-store'
import { useFileTreeStore } from '@/features/editor/stores/file-tree-store'
import { SphereLoader } from '../ui/loaders'
  
  export function AppHeader() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const chatContext = getChatChromeContext(pathname)
    const toggleChatPanel = useEditorStore((s) => s.toggleChatPanel)
    const activateFocusMode = useEditorStore((s) => s.activateFocusMode)
  
    return (
      <header className="flex h-11 shrink-0 items-center justify-between border-border  px-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* <div className="flex size-6 items-center justify-center rounded-md bg-primary">
              <span className="text-xs font-bold text-primary-foreground">S</span>
            </div> */}
            <SphereLoader isLoading={true} size={32} showRings={false} />
            <span className="text-sm font-semibold text-foreground">Sohizi Lab</span>
          </div>
  
          <span className="text-muted-foreground/40">|</span>
  
          <Suspense fallback={<Skeleton className="w-20 h-7" />}>
            <ProjectDropdown />
          </Suspense>
        </div>
  
        <div className="flex items-center gap-2">
  
          <ThemeToggle />
  
          <button onClick={() => activateFocusMode(chatContext)}>
            <IconFocus2 className="size-4 text-foreground" />
          </button>
  
          <button onClick={() => toggleChatPanel(chatContext)}>
            <IconSparkle className="size-4 text-primary" />
          </button>
        </div>
      </header>
    )
  }
  
  const ProjectDropdown = () => {
    const { data: session } = useSession()
    const organizationId = session?.session.activeOrganizationId ?? undefined
  
    if (!organizationId) {
      return <Skeleton className="w-20 h-7" />
    }
  
    return <ProjectDropdownContent organizationId={organizationId} />
  }
  
  const ProjectDropdownContent = ({ organizationId }: { organizationId: string }) => {
    const { data: projects = [] } = useSuspenseInfiniteQuery(getListProjectsQueryOptions({cursor: undefined, limit: 20, organizationId}))
    const currentProjectTitle = useFileTreeStore(state => state.project?.title)
    const [open, setOpen] = useState(false)
  
    const handleLinkClick = () => {
      setOpen(false)
    }
    
    return (
  
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground">
            <span className="text-xs">{currentProjectTitle}</span>
            <ChevronDown className="size-3" />
          </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl h-[70%] max-h-[800px] bg-gray-800 rounded-xl flex flex-col" showCloseButton={false}>
          <DialogDescription className="sr-only">Projects settings</DialogDescription>
          <DialogHeader >
              <DialogTitle>All Projects</DialogTitle>
          </DialogHeader>
          <div className="flex gap-4 h-full min-h-0 flex-1">
            {projects.map((project) => (
              <Link to='/dashboard/projects/$projectId/editor' 
                    params={{ projectId: project.id }} 
                    key={project.id} 
                    className='w-full'
                    onClick={handleLinkClick}
              >
                <div key={project.id} 
                        className="w-full border-b dark:border-white/10 hover:bg-gray-200/10 hover:rounded-lg px-4 py-2 cursor-pointer"
                >
                  {project.title}
                </div>
              </Link>
            ))}  
          </div>
  
          <div className="absolute -top-8 -right-8">
              <DialogClose asChild>
                  <Button size="icon" className="border dark:border-gray-700 rounded-full">
                      <IconX className="size-4" />
                  </Button>
              </DialogClose>
          </div>
  
      </DialogContent>
    </Dialog>
    )
  }
  
  