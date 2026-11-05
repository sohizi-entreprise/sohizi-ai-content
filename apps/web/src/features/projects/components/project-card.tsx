import { MoreVertical, Pencil, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { isAxiosError } from "axios"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@sohizi/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sohizi/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Button } from "@sohizi/ui/button"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Spinner } from "@sohizi/ui/spinner"
import {
  deleteProjectMutationOptions,
  updateProjectMutationOptions,
} from "../query-mutation"
import { renameProjectSchema } from "../schema"
import type { FormEvent } from "react"
import type { ProjectListItem } from "../type"
import { timeFromNow } from "@/lib/utils"

type ProjectCardProps = ProjectListItem & {
  display?: "list" | "grid"
}

export default function ProjectCard(props: ProjectCardProps) {
  const { id, title, createdAt, display = "grid" } = props

  if (display === "list") {
    return <ProjectCardList {...props} />
  }

  return (
    <Card className="glass-panel rounded-2xl transition-all duration-400 gap-6 hover:border-primary/30! group cursor-pointer flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-2 flex-1">
            <CardTitle className="text-xl font-bold text-white group-hover:text-primary group-hover:scale-102 transition-all duration-300">
              {title}
            </CardTitle>
            {/* <p className="text-sm text-muted-foreground capitalize">
                            {genre}
                        </p> */}
          </div>
          <ProjectCardAction projectId={id} title={title} />
        </div>
      </CardHeader>

      {/* Text skeleton in the middle */}
      <CardContent className="flex-1 px-6">
        <WritingSkeleton />
      </CardContent>

      {/* Page count at bottom right */}
      <CardFooter>
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-muted-foreground font-medium uppercase">
            {timeFromNow(createdAt)}
          </p>
          {/* <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                        {durationMin} MIN
                    </p> */}
        </div>
      </CardFooter>
    </Card>
  )
}

function ProjectCardList(props: ProjectCardProps) {
  const { id, title, createdAt } = props

  return (
    <div className="glass-panel py-4 px-6 rounded-2xl transition-all duration-400 hover:border-primary/30! group cursor-pointer flex gap-4 items-center">
      <div className="flex-1">
        <div className="text-xl font-bold text-white group-hover:text-primary transition-all duration-300 group-hover:scale-102 mb-2">
          {title}
        </div>
        <div className="flex items-center gap-2">
          {/* <p className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400 font-bold uppercase tracking-widest">
                        {genre}
                    </p> */}
        </div>
      </div>

      <div className="w-fit space-y-1">
        {/* <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest text-right">
                    {durationMin} MIN
                </p> */}
        <div className="bg-primary w-full h-0.5 rounded-full" />
        <p className="text-xs text-muted-foreground font-medium uppercase">
          {timeFromNow(createdAt)}
        </p>
      </div>

      <div>
        <ProjectCardAction projectId={id} title={title} />
      </div>
    </div>
  )
}

function ProjectCardAction({
  projectId,
  title,
}: {
  projectId: string
  title: string
}) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div
      onClick={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
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
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setRenameOpen(true)
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameProjectDialog
        open={renameOpen}
        title={title}
        projectId={projectId}
        onOpenChange={setRenameOpen}
      />
      <DeleteProjectDialog
        open={deleteOpen}
        title={title}
        projectId={projectId}
        onOpenChange={setDeleteOpen}
      />
    </div>
  )
}

function RenameProjectDialog({
  open,
  title,
  projectId,
  onOpenChange,
}: {
  open: boolean
  title: string
  projectId: string
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState(title)
  const [error, setError] = useState("")
  const { mutate: updateProject, isPending } = useMutation(
    updateProjectMutationOptions,
  )

  useEffect(() => {
    if (!open) return
    setName(title)
    setError("")
  }, [open, title])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setError("")

    const output = renameProjectSchema.safeParse({ title: name.trim() })
    if (!output.success) {
      setError(output.error.issues[0]?.message ?? "Invalid project name")
      return
    }

    updateProject(
      { id: projectId, title: output.data.title },
      {
        onSuccess: () => {
          toast.success("Project renamed")
          onOpenChange(false)
        },
        onError: (updateError) => {
          if (
            isAxiosError(updateError) &&
            typeof updateError.response?.data?.error === "string"
          ) {
            setError(updateError.response.data.error)
            return
          }
          setError(
            updateError instanceof Error
              ? updateError.message
              : "Failed to rename project",
          )
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Update the name shown on this project.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`rename-project-${projectId}`}>Project name</Label>
            <Input
              id={`rename-project-${projectId}`}
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setError("")
              }}
              required
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? <Spinner /> : null}
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteProjectDialog({
  open,
  title,
  projectId,
  onOpenChange,
}: {
  open: boolean
  title: string
  projectId: string
  onOpenChange: (open: boolean) => void
}) {
  const [confirmTitle, setConfirmTitle] = useState("")
  const [error, setError] = useState("")
  const { mutate: deleteProject, isPending } = useMutation(
    deleteProjectMutationOptions,
  )

  useEffect(() => {
    if (!open) return
    setConfirmTitle("")
    setError("")
  }, [open])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setError("")

    if (confirmTitle !== title) {
      setError("Title does not match")
      return
    }

    deleteProject(
      { id: projectId, title: confirmTitle },
      {
        onSuccess: () => {
          toast.success("Project deleted")
          onOpenChange(false)
        },
        onError: (deleteError) => {
          if (
            isAxiosError(deleteError) &&
            typeof deleteError.response?.data?.error === "string"
          ) {
            setError(deleteError.response.data.error)
            return
          }
          setError(
            deleteError instanceof Error
              ? deleteError.message
              : "Failed to delete project",
          )
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Delete project</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Enter{" "}
            <span className="font-semibold text-foreground">{title}</span> to
            confirm.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`delete-project-${projectId}`}>Project title</Label>
            <Input
              id={`delete-project-${projectId}`}
              type="text"
              value={confirmTitle}
              placeholder={title}
              onChange={(event) => {
                setConfirmTitle(event.target.value)
                setError("")
              }}
              required
              autoFocus
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={isPending || confirmTitle !== title}
            >
              {isPending ? <Spinner /> : null}
              {isPending ? "Deleting..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function WritingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-2 bg-slate-400/10 rounded-full w-1/3" />
      <div className="h-2 bg-slate-400/10 rounded-full w-full" />
      <div className="h-2 bg-slate-400/8 rounded-full w-[90%]" />
      <div className="h-2 bg-slate-400/6 rounded-full w-[90%] mx-auto" />
      <div className="h-2 bg-slate-400/4 rounded-full w-full" />
      <div className="h-2 bg-slate-400/2 rounded-full w-[85%]" />
      <div className="h-2 bg-slate-400/1 rounded-full w-[92%]" />
    </div>
  )
}
