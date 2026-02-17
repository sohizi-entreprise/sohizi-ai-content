import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreVertical, Trash2 } from 'lucide-react'
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ProjectFormat } from '../type'
import ProjectStatus from './project-status'

type ProjectCardProps = {
    id: string
    name: string
    format: ProjectFormat
    genre: string
    pageCount?: number
    onDelete?: () => void
    display?: 'list' | 'grid'
}

export default function ProjectCard(props: ProjectCardProps) {
    const { name, genre, pageCount = 1, onDelete, display = 'grid' } = props

    if (display === 'list') {
        return <ProjectCardList {...props} />
    }
    
    return (
        <Card className="glass-panel rounded-2xl transition-all duration-400 gap-6 hover:border-primary/30! group cursor-pointer flex flex-col">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="space-y-2 flex-1">
                        <ProjectStatus status='DRAFTING'/>
                        <CardTitle className="text-xl font-bold text-white group-hover:text-primary group-hover:scale-102 transition-all duration-300">{name}</CardTitle>
                        <p className="text-sm text-muted-foreground capitalize">
                            {genre}
                        </p>
                    </div>
                    <ProjectCardAction onDelete={onDelete}/>
                </div>
            </CardHeader>
            
            {/* Text skeleton in the middle */}
            <CardContent className="flex-1 px-6">
                <WritingSkeleton/>
            </CardContent>

            {/* Page count at bottom right */}
            <CardFooter>
                <div className="flex items-center justify-between w-full">
                    <p className="text-xs text-muted-foreground font-medium uppercase">
                        Upd. 1 day ago
                    </p>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                        {pageCount} {`${pageCount > 1 ? 'PAGES' : 'PAGE'}`}
                    </p>
                </div>
            </CardFooter>
        </Card>
    )
}


function ProjectCardList(props: ProjectCardProps){
    const { name, genre, pageCount = 1, onDelete } = props

    return (
        <div className='glass-panel py-4 px-6 rounded-2xl transition-all duration-400 hover:border-primary/30! group cursor-pointer flex gap-4 items-center'>
            <div className='flex-1'>
                <div className="text-xl font-bold text-white group-hover:text-primary transition-all duration-300 group-hover:scale-102 mb-2">{name}</div>
                <div className='flex items-center gap-2'>
                    <p className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-bold uppercase">
                        {genre}
                    </p>
                    <ProjectStatus status='DRAFTING'/>
                </div>
            </div>
        
            <div className='w-fit space-y-1'>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest text-right">
                    {pageCount} {`${pageCount > 1 ? 'PAGES' : 'PAGE'}`}
                </p>
                <div className='bg-primary w-full h-[2px] rounded-full'/>
                <p className="text-xs text-muted-foreground font-medium uppercase">
                        Upd. 1 day ago
                </p>
            </div>

            <div>
                <ProjectCardAction onDelete={onDelete}/>
            </div>

        </div>
    )
}

function ProjectCardAction({onDelete}: {onDelete?: () => void}){
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="transition-opacity h-8 w-8"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                        e.preventDefault()
                        onDelete?.()
                    }}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}


function WritingSkeleton(){

    return(
        <div className="space-y-3">
            <div className="h-2 bg-slate-400/10 rounded-full w-1/3" />
            <div className="h-2 bg-slate-400/10 rounded-full w-full" />
            <div className="h-2 bg-slate-400/8 rounded-full w-[90%]"/>
            <div className="h-2 bg-slate-400/6 rounded-full w-[90%] mx-auto" />
            <div className="h-2 bg-slate-400/4 rounded-full w-full" />
            <div className="h-2 bg-slate-400/2 rounded-full w-[85%]" />
            <div className="h-2 bg-slate-400/1 rounded-full w-[92%]" />
        </div>
    )
}
