import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreVertical, Trash2 } from 'lucide-react'
import { DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { ProjectFormat } from '../type'

type ProjectCardProps = {
    id: string
    name: string
    format: ProjectFormat
    createdAt: string
    onDelete?: () => void
}


export default function ProjectCard(props: ProjectCardProps) {
    const { name, format, createdAt, onDelete } = props
  return (
    <Card
        // key={project.id}
        className="group relative transition-all hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/5 cursor-pointer"
        >
        <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
            <div className="space-y-1">
                <CardTitle className="line-clamp-1">{name}</CardTitle>
                <CardDescription>
                {format}
                </CardDescription>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={onDelete}
                >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            </div>
        </CardHeader>
        <CardContent>
            <p className="mt-3 text-xs text-muted-foreground">
            Created {new Date(createdAt).toLocaleDateString()}
            </p>
        </CardContent>
    </Card>
  )
}
