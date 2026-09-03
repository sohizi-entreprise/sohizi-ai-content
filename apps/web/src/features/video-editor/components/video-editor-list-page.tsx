import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { Clapperboard, Plus } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@sohizi/ui/empty"
import { Skeleton } from "@sohizi/ui/skeleton"
import { VideoEditorCard } from "./video-editor-card"
import { CreateVideoEditorModal } from "./create-video-editor-modal"
import { listFilesByFormatQueryOptions } from "@/features/projects/query-mutation"

export function VideoEditorListPage() {
  const { projectId } = useParams({ from: "/dashboard/projects/$projectId" })
  const [createOpen, setCreateOpen] = useState(false)

  const {
    data: files = [],
    isLoading,
    isError,
    refetch,
  } = useQuery(listFilesByFormatQueryOptions(projectId, "video-editor"))

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video editor</h1>
          <p className="text-sm text-muted-foreground">
            Open an existing composition or start a new one.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New video
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8">
        {isLoading ? (
          <VideoEditorListSkeleton />
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/40 p-8">
            <p className="text-sm text-destructive">
              Failed to load video editors
            </p>
            <Button variant="outline" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : files.length === 0 ? (
          <Empty className="border border-dashed py-16">
            <EmptyHeader>
              <EmptyTitle>No video editors yet</EmptyTitle>
              <EmptyDescription>
                Create a video editor file to start composing timelines.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => setCreateOpen(true)}>
                <Clapperboard className="size-4" />
                New video
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {files.map((file) => (
              <Link
                key={file.id}
                to="/dashboard/projects/$projectId/video-editor/$fileNodeId"
                params={{ projectId, fileNodeId: file.id }}
                className="block"
                preload={false}
              >
                <VideoEditorCard file={file} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <CreateVideoEditorModal
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  )
}

function VideoEditorListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-[220px] w-full rounded-2xl" />
      ))}
    </div>
  )
}
