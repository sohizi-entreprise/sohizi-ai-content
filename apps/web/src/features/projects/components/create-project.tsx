import { captureAnalyticsEvent } from "@sohizi/analytics/browser"
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
import { createProjectMutationOptions } from "../query-mutation"
import { createProjectSchema } from "../schema"
import type { FormEvent, ReactNode } from "react"

type CreateProjectProps = {
  trigger?: ReactNode
}

export default function CreateProject({ trigger }: CreateProjectProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const { mutate: createProject, isPending } = useMutation(
    createProjectMutationOptions,
  )
  const navigate = useNavigate()

  const handleCreateProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")

    const output = createProjectSchema.safeParse({ title: name.trim() })
    if (!output.success) {
      setError(output.error.issues[0]?.message ?? "Invalid project name")
      return
    }

    createProject(output.data, {
      onSuccess: async (response) => {
        captureAnalyticsEvent("project_created", {
          project_id: response.id,
          mode: "blank",
        })
        toast.success("Blank project created")
        setName("")
        setOpen(false)
        await navigate({
          to: "/projects/$projectId/editor",
          params: {
            projectId: response.id,
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
        {trigger ?? (
          <Button className="flex items-center gap-2 rounded-xl px-5 font-semibold">
            <IconCirclePlusFilled className="size-5" />
            Start blank project
          </Button>
        )}
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
