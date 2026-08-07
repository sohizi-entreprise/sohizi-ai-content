import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { filesByFormatKey } from '@/features/projects/query-mutation'
import {
  getMarketSkillQueryOptions,
  installSkillMutationOptions,
} from '../query-mutation'
import { SkillNameConflictError } from '../request'
import { ReadonlySkillViewer } from './readonly-skill-viewer'
import { SkillNameConflictModal } from './skill-name-conflict-modal'

export function SkillMarketDetailPage() {
  const { projectId, skillId } = useParams({
    from: '/dashboard/projects/$projectId/skill-market/$skillId',
  })
  const queryClient = useQueryClient()
  const [added, setAdded] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<'replace' | 'rename' | null>(null)

  const { data: skill, isLoading, isError, refetch } = useQuery(
    getMarketSkillQueryOptions(skillId),
  )

  const installMutation = useMutation({
    ...installSkillMutationOptions(projectId),
    onSuccess: async () => {
      setAdded(true)
      setConflictOpen(false)
      setPendingMode(null)
      toast.success('Skill added to project')
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['project', projectId, 'file-tree'],
        }),
        queryClient.invalidateQueries({
          queryKey: filesByFormatKey(projectId, 'skill'),
        }),
      ])
    },
    onError: (error) => {
      setPendingMode(null)
      if (error instanceof SkillNameConflictError) {
        setConflictOpen(true)
        return
      }
      toast.error(error instanceof Error ? error.message : 'Failed to add skill')
    },
  })

  const handleAdd = () => {
    installMutation.mutate({ skillId, mode: 'create' })
  }

  const handleReplace = () => {
    setPendingMode('replace')
    installMutation.mutate({ skillId, mode: 'replace' })
  }

  const handleRename = (name: string) => {
    setPendingMode('rename')
    installMutation.mutate({ skillId, mode: 'rename', name })
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="space-y-3 border-b border-border px-6 py-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex-1 px-6 py-8">
          <Skeleton className="mx-auto h-[420px] max-w-3xl rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !skill) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
        <p className="text-sm text-destructive">Failed to load skill</p>
        <Button variant="outline" onClick={() => void refetch()}>
          Retry
        </Button>
        <Button variant="ghost" asChild>
          <Link
            to="/dashboard/projects/$projectId/skill-market"
            params={{ projectId }}
          >
            Back to Skill market
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Link
              to="/dashboard/projects/$projectId/skill-market"
              params={{ projectId }}
            >
              <ArrowLeft className="size-4" />
              Skill market
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{skill.name}</h1>
            {skill.categories.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {skill.categories.map((category) => (
                  <Badge key={category.id} variant="secondary" className="text-[10px]">
                    {category.name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <Button
          onClick={handleAdd}
          disabled={added || installMutation.isPending}
        >
          {installMutation.isPending && !conflictOpen ? (
            <Loader2 className="size-4 animate-spin" />
          ) : added ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {added ? 'Added' : 'Add to project'}
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface">
        <ReadonlySkillViewer
          description={skill.description}
          instructions={skill.instructions}
        />
      </div>

      <SkillNameConflictModal
        projectId={projectId}
        open={conflictOpen}
        skillName={skill.name}
        onOpenChange={setConflictOpen}
        onReplace={handleReplace}
        onRename={handleRename}
        isReplacing={installMutation.isPending && pendingMode === 'replace'}
        isRenaming={installMutation.isPending && pendingMode === 'rename'}
      />
    </div>
  )
}
