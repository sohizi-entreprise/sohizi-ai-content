import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { IconTemplate } from '@tabler/icons-react'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { createTemplateSchema } from '../schema'
import { createTemplateMutationOptions } from '../query-mutation'
import type { FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

export default function CreateTemplate() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const { mutate: createTemplate, isPending } = useMutation(
    createTemplateMutationOptions,
  )
  const navigate = useNavigate()
  const slug = toSlug(name)

  const handleCreateTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const output = createTemplateSchema.safeParse({ name: name.trim() })
    if (!output.success) {
      setError(output.error.issues[0]?.message ?? 'Invalid template name')
      return
    }

    createTemplate(output.data, {
      onSuccess: async (response) => {
        toast.success('Template created')
        setName('')
        setOpen(false)
        await navigate({
          to: '/dashboard/projects/$projectId/editor',
          params: {
            projectId: response.project.id,
          },
        })
      },
      onError: (createError) => {
        if (
          isAxiosError(createError) &&
          typeof createError.response?.data?.error === 'string'
        ) {
          setError(createError.response.data.error)
          return
        }
        setError(
          createError instanceof Error
            ? createError.message
            : 'Failed to create template',
        )
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 hover:scale-105"
        >
          <IconTemplate className="size-6" />
          Create Template
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Start a reusable template project that can be used as a base for
            future projects.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleCreateTemplate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              type="text"
              placeholder="Short film storyboard"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
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
              {isPending ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
