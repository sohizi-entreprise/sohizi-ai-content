import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@sohizi/ui/badge"
import { Button } from "@sohizi/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@sohizi/ui/sheet"
import { Skeleton } from "@sohizi/ui/skeleton"
import {
  getMarketSkillQueryOptions,
  installSkillMutationOptions,
} from "../query-mutation"
import { SkillNameConflictError } from "../request"
import { ReadonlySkillViewer } from "./readonly-skill-viewer"
import { SkillNameConflictModal } from "./skill-name-conflict-modal"
import { filesByTypeKey } from "@/features/projects/query-mutation"

type SkillMarketDetailSheetProps = {
  projectId: string
  skillId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SkillMarketDetailSheet({
  projectId,
  skillId,
  open,
  onOpenChange,
}: SkillMarketDetailSheetProps) {
  const queryClient = useQueryClient()
  const [added, setAdded] = useState(false)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<"replace" | "rename" | null>(
    null,
  )

  useEffect(() => {
    setAdded(false)
    setConflictOpen(false)
    setPendingMode(null)
  }, [skillId])

  const {
    data: skill,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    ...getMarketSkillQueryOptions(skillId ?? ""),
    enabled: Boolean(skillId) && open,
  })

  const installMutation = useMutation({
    ...installSkillMutationOptions(projectId),
    onSuccess: async () => {
      setAdded(true)
      setConflictOpen(false)
      setPendingMode(null)
      toast.success("Skill added to project")
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["project", projectId, "file-tree"],
        }),
        queryClient.invalidateQueries({
          queryKey: filesByTypeKey(projectId, "skill"),
        }),
      ])
    },
    onError: (error) => {
      setPendingMode(null)
      if (error instanceof SkillNameConflictError) {
        setConflictOpen(true)
        return
      }
      toast.error(
        error instanceof Error ? error.message : "Failed to add skill",
      )
    },
  })

  const handleAdd = () => {
    if (!skillId) return
    installMutation.mutate({ skillId, mode: "create" })
  }

  const handleReplace = () => {
    if (!skillId) return
    setPendingMode("replace")
    installMutation.mutate({ skillId, mode: "replace" })
  }

  const handleRename = (name: string) => {
    if (!skillId) return
    setPendingMode("rename")
    installMutation.mutate({ skillId, mode: "rename", name })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 overflow-visible p-0 sm:max-w-2xl"
      >
        <SheetClose asChild>
          <Button
            size="icon"
            className="absolute top-2 -left-10 z-10 size-8 rounded-full"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </SheetClose>
        {isLoading || !skillId ? (
          <SkillDetailSkeleton />
        ) : isError || !skill ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <SheetHeader className="sr-only">
              <SheetTitle>Skill details</SheetTitle>
              <SheetDescription>Failed to load this skill.</SheetDescription>
            </SheetHeader>
            <p className="text-sm text-destructive">Failed to load skill</p>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <SheetHeader className="shrink-0 space-y-0 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <SheetTitle className="truncate text-lg">
                    {skill.name}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    {skill.description || "Skill details"}
                  </SheetDescription>
                  {skill.categories.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {skill.categories.map((category) => (
                        <Badge
                          key={category.id}
                          variant="secondary"
                          className="text-[10px]"
                        >
                          {category.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button
                  onClick={handleAdd}
                  disabled={added || installMutation.isPending}
                  className="shrink-0"
                >
                  {installMutation.isPending && !conflictOpen ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : added ? (
                    <Check className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  {added ? "Added" : "Add to project"}
                </Button>
              </div>
            </SheetHeader>

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
              isReplacing={
                installMutation.isPending && pendingMode === "replace"
              }
              isRenaming={installMutation.isPending && pendingMode === "rename"}
            />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function SkillDetailSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <SheetHeader className="space-y-3 border-b border-border">
        <SheetTitle className="sr-only">Skill details</SheetTitle>
        <SheetDescription className="sr-only">
          Loading skill details
        </SheetDescription>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-32" />
      </SheetHeader>
      <div className="flex-1 px-6 py-8">
        <Skeleton className="h-105 w-full rounded-xl" />
      </div>
    </div>
  )
}
