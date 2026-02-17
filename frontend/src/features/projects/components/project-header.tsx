import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IconBulb, IconCheck, IconCirclePlusFilled, IconPencil, IconSearch } from '@tabler/icons-react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'

export default function ProjectHeader() {
    const searchQuery = useSearch({ from: '/dashboard/main/projects' })
    const navigate = useNavigate()

    const changeDisplay = (display: 'list' | 'grid') => () => {
        navigate({
            to: '/dashboard/main/projects',
            search: { ...searchQuery, display },
        })
    }
   
  return (
    <div className='flex flex-col gap-8 pt-8 font-space-grotesk'>
        <div className='flex items-center justify-between'>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Project Command Center</h1>
                <p className="text-slate-500 text-sm mt-1">Your journey starts here. Manage &amp; start new adventures.</p>
            </div>
            
            <div className='flex items-center gap-4'>
                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 relative">
                    <button className={cn("px-3 py-1.5 rounded-lg text-slate-500 text-xs font-bold", {'text-primary': searchQuery.display === 'grid'})} onClick={changeDisplay('grid')}>GRID</button>
                    <button className={cn("px-3 py-1.5 rounded-lg text-slate-500 text-xs font-bold", {'text-primary': searchQuery.display === 'list'})} onClick={changeDisplay('list')}>LIST</button>
                    <div className={cn("absolute bottom-[2px] left-px w-1/2 h-[calc(100%-4px)] bg-primary/20 rounded-xl transition-all duration-300", {
                        'translate-x-px': searchQuery.display === 'grid',
                        'translate-x-[calc(100%-2px)]': searchQuery.display === 'list',
                    })} />
                </div>
                <Link to="/dashboard/projects/new">
                    <Button className="bg-primary hover:bg-accent text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-xl shadow-primary/10 hover:scale-105">
                        <IconCirclePlusFilled className="size-6" />
                        New Project
                    </Button>
                </Link>
            </div>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <IconSearch className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className="w-full bg-white/5 border-none rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:ring-1 focus:ring-primary/40 transition-all" placeholder="Query projects by title, character, or plot point..." type="text"/>
            </div>
            <div className="h-8 w-px bg-white/10 hidden md:block" />
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Genres</span>
                <button className="px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-medium whitespace-nowrap">All</button>
                <button className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400 text-xs font-medium hover:border-white/30 whitespace-nowrap">Sci-Fi</button>
                <button className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400 text-xs font-medium hover:border-white/30 whitespace-nowrap">Noir</button>
                <button className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400 text-xs font-medium hover:border-white/30 whitespace-nowrap">Drama</button>
                <button className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-slate-400 text-xs font-medium hover:border-white/30 whitespace-nowrap">More</button>
            </div>
            <div className="h-8 w-px bg-white/10 hidden md:block" />
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Status</span>
                <div className="flex space-x-1">
                    <button className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 group relative">
                        <IconPencil className="size-4" />
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">Drafting</div>
                    </button>
                    <button className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 group relative">
                    <IconBulb className="size-4" />
                    </button>
                    <button className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 group relative">
                    <IconCheck className="size-4" />
                </button>
                </div>
            </div>
        </div>

    </div>
  )
}
