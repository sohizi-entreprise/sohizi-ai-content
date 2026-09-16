import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { IconCirclePlusFilled } from "@tabler/icons-react"
import { toast } from "sonner"
import { isAxiosError } from "axios"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@sohizi/ui/dialog"
import { Input } from "@sohizi/ui/input"
import { Label } from "@sohizi/ui/label"
import { Spinner } from "@sohizi/ui/spinner"
import { createTemplateMutationOptions } from "../query-mutation"
import { createTemplateSchema } from "../schema"
import type { FormEvent } from "react"

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
}

export default function CreateProject() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const { mutate: createProject, isPending } = useMutation(
    createTemplateMutationOptions,
  )
  const navigate = useNavigate()
  const slug = toSlug(name)

  const handleCreateProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    const output = createTemplateSchema.safeParse({ name: name.trim() })
    if (!output.success) {
      setError(output.error.issues[0]?.message ?? "Invalid project name")
      return
    }

    createProject(output.data, {
      onSuccess: async (response) => {
        toast.success("Blank project created")
        setName("")
        setOpen(false)
        await navigate({
          to: "/projects/$projectId/editor",
          params: {
            projectId: response.project.id,
          },
        })
      },
      onError: (createError) => {
        if (
          isAxiosError(createError) &&
          typeof createError.response?.data?.error === "string"
        ) {
          setError(createError.response.data.error)
          return
        }
        setError(
          createError instanceof Error
            ? createError.message
            : "Failed to create project",
        )
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90 cursor-pointer text-black font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-xl shadow-primary/10 hover:scale-105">
          <IconCirclePlusFilled className="size-6" />
          Start blank project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start blank project</DialogTitle>
          <DialogDescription>
            Create an empty project you can fill in from scratch.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              type="text"
              placeholder="Short film storyboard"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError("")
              }}
              required
              autoFocus
            />
            {name && (
              <p className="text-xs text-muted-foreground">Slug: {slug}</p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Spinner />}
              {isPending ? "Creating..." : "Start blank project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
