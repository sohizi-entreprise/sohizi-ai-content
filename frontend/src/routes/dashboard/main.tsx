import Container from '@/components/layout/container'
import { cn } from '@/lib/utils'
import { IconLayoutGrid, IconMovie, IconSettings, IconUser } from '@tabler/icons-react'
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/main')({
  component: RouteComponent,
})

const links = [
    {
        label: 'Projects',
        href: '/dashboard/main/projects',
        icon: <IconLayoutGrid className='size-5' />,
    },
    {
        label: 'Account',
        href: '#',
        icon: <IconUser className='size-5'/>,
    },
    {
        label: 'Settings',
        href: '#',
        icon: <IconSettings className='size-5'/>,
    },
]


function RouteComponent() {

    const activeLinkClass = 'bg-white/5 border border-white/10 text-primary'
    const pathname = useLocation({
        select: (location) => location.pathname,
    })

  return (
  <div className='min-h-screen bg-background flex'>
    {/* Nav bar */}
    <aside className='w-64 bg-background/80 border-r border-white/5 backdrop-blur-xl flex flex-col px-4 pb-8'>
        <div className="h-20 flex items-center px-6">
            <IconMovie className='size-5 text-primary' />
            <span className="hidden lg:block text-2xl font-bold tracking-tighter ml-3">Sohizi<span className="text-primary italic">AI</span></span>
        </div>
        {/* Nav bar items */}
        <nav className='flex-1 overflow-y-auto space-y-2 py-8 font-space-grotesk'>
            {
                links.map((link) => (
                    <Link key={link.label} to={link.href} className={cn('flex items-center gap-4 px-4 py-3 font-medium tracking-wide rounded-xl hover:bg-accent', {[activeLinkClass]: pathname === link.href})}>
                        {link.icon}
                        {link.label}
                    </Link>
                ))
            }
        </nav>
        {/* Compute usage */}
        <div className="p-4 rounded-2xl bg-linear-to-br from-slate-900 to-black border border-primary/20">
            <p className="text-[10px] text-primary font-bold uppercase mb-1">Compute Usage</p>
            <div className="w-full h-1.5 bg-white/10 rounded-full mb-2 overflow-hidden">
                <div className="w-[65%] h-full bg-primary rounded-full"/>
            </div>
            <p className="text-[11px] text-slate-400">6.5k / 10k AI Tokens used</p>
        </div>

        <div className="mt-4 flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold">JD</div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">Jane Doe</p>
                <p className="text-[10px] text-primary/70 uppercase font-bold">Neural Plan</p>
            </div>
            <IconSettings className="size-5 text-slate-500" />
        </div>

    </aside>

    {/* Main content */}
    <div className='flex-1 overflow-y-auto'>
        <Container>
            <Outlet />
        </Container>
    </div>
  </div>
)
}
