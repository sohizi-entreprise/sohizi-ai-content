import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { skillNameAvailableQueryOptions } from '../query-mutation'

type SkillNameConflictModalProps = {
  projectId: string
  open: boolean
  skillName: string
  onOpenChange: (open: boolean) => void
  onReplace: () => void
  onRename: (name: string) => void
  isReplacing?: boolean
  isRenaming?: boolean
}

function suggestRename(name: string) {
  const match = name.match(/^(.*?)(?:\s\((\d+)\))?$/)
  if (!match) return `${name} (2)`
  const base = match[1]?.trim() || name
  const next = Number(match[2] ?? '1') + 1
  return `${base} (${next})`
}

export function SkillNameConflictModal({
  projectId,
  open,
  skillName,
  onOpenChange,
  onReplace,
  onRename,
  isReplacing = false,
  isRenaming = false,
}: SkillNameConflictModalProps) {
  const [renameValue, setRenameValue] = useState('')
  const [debouncedName, setDebouncedName] = useState('')

  useEffect(() => {
    if (!open) return
    setRenameValue(suggestRename(skillName))
  }, [open, skillName])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedName(renameValue.trim())
    }, 250)
    return () => window.clearTimeout(timer)
  }, [renameValue])

  const trimmedName = renameValue.trim()
  const { data: availability, isFetching } = useQuery(
    skillNameAvailableQueryOptions(
      projectId,
      debouncedName,
      open && debouncedName.length > 0,
    ),
  )

  const nameTaken =
    trimmedName.length > 0 &&
    debouncedName === trimmedName &&
    availability?.available === false
  const nameReady =
    trimmedName.length > 0 &&
    debouncedName === trimmedName &&
    availability?.available === true &&
    !isFetching

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skill already exists</DialogTitle>
          <DialogDescription>
            A skill named “{skillName}” is already in this project. You can replace
            it with the market version, or add this skill under a new name.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={isReplacing || isRenaming}
            onClick={onReplace}
          >
            {isReplacing ? <Loader2 className="size-4 animate-spin" /> : null}
            Replace existing
          </Button>

          <div className="space-y-2">
            <Label htmlFor="skill-rename">Rename new skill</Label>
            <div className="flex gap-2">
              <Input
                id="skill-rename"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                className={cn(nameTaken && 'border-destructive focus-visible:ring-destructive')}
                disabled={isReplacing || isRenaming}
                maxLength={50}
              />
              <Button
                type="button"
                disabled={!nameReady || isReplacing || isRenaming}
                onClick={() => onRename(trimmedName)}
              >
                {isRenaming ? <Loader2 className="size-4 animate-spin" /> : null}
                Rename
              </Button>
            </div>
            {nameTaken ? (
              <p className="text-xs text-destructive">
                A skill with this name already exists. Choose another name.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isReplacing || isRenaming}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
