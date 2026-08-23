import { useRef, useState } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Eye, RotateCcw, Trash2 } from 'lucide-react'
import { useBufferChunks } from '@/features/chat/hooks/use-buffer-chunks'
import { DotsLoader, SphereLoader } from '@/components/ui/loaders'
import { MediaCard } from './media-card'
import { MediaCardMenu } from './media-card-menu'
import { RequestSettingsDialog } from './request-settings-dialog'
import { DotGridLoader } from './dot-grid-loader'
import { GENERATION_TYPES } from '../constants'
import { useRequestActions } from '../hooks/use-request-actions'
import { extractLastMessageContent } from '../lib/agent-progress'
import { usePatchAiGeneratedRequest, useUpdateAssetsList } from '../query-mutations'
import type { LucideIcon } from 'lucide-react'
import type { AiGeneratedMediaRequest, AiGeneratedRequestAsset, GenerationType, MediaAsset } from '../types'

type MediaCardRendererProps = {
  item: AiGeneratedMediaRequest
  projectId: string
  selectedAssetIds: string[]
  onSelectedChange?: (assetId: string, selected: boolean) => void
}

export default function MediaCardRenderer({
  item,
  projectId,
  selectedAssetIds,
  onSelectedChange,
}: MediaCardRendererProps) {
  const isRunning = item.status === 'pending' || item.status === 'processing'
  const isFailed = item.status === 'failed' || item.status === 'aborted'

  if (isRunning) {
    return <PendingMediaCard item={item} />
  }

  if (isFailed) {
    return <FailedMediaCard item={item} projectId={projectId} />
  }

  return (
    <CompletedMediaCards
      item={item}
      projectId={projectId}
      selectedAssetIds={selectedAssetIds}
      onSelectedChange={onSelectedChange}
    />
  )
}

function PendingMediaCard({ item }: { item: AiGeneratedMediaRequest }) {
  const assetsRef = useRef(item.assets)
  const updateAssetsList = useUpdateAssetsList(item.projectId)
  const patchRequest = usePatchAiGeneratedRequest(item.projectId)

  const runMode = item.request?.runMode === 'agent' ? 'agent' : 'direct'
  const generationType = getRequestGenerationType(item.request)

  const url = `${import.meta.env.VITE_API_BASE_URL}/media/${item.projectId}/requests/${item.id}`
  const { messages } = useBufferChunks({
    url,
    initialMessages: [],
    onAsset: (asset) => {
      const nextAsset = toRequestAsset(asset)
      assetsRef.current = mergeRequestAssets(assetsRef.current, [nextAsset])
      updateAssetsList([asset], item.id)
    },
    onFinish: () => {
      patchRequest(item.id, {
        status: assetsRef.current.length > 0 ? 'completed' : 'failed',
        assets: assetsRef.current,
      })
    },
  })
  if (runMode === 'direct') {
    const GenerationIcon = GENERATION_TYPE_ICONS[generationType]
    return (
        <StreamingContainer>
            <div className="flex flex-col min-w-0 items-center gap-2">
                <GenerationIcon className="size-4 shrink-0 text-foreground" />
                <DotsLoader bgColor="text-foreground" />
            </div>
        </StreamingContainer>

    )
  }

  const progressText = extractLastMessageContent(messages, true)

  return (
    <StreamingContainer>
      <div className="flex shrink-0 items-center gap-2 px-2 py-1.5">
        <SphereLoader isLoading size={18} showRings={false} />
        <p className="min-w-0 truncate text-xs tracking-wide text-muted-foreground">
          {progressText}
        </p>
      </div>
    </StreamingContainer>
    
  )
}

function FailedMediaCard({
  item,
  projectId,
}: {
  item: AiGeneratedMediaRequest
  projectId: string
}) {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const { onDelete, onReuseSettings } = useRequestActions(projectId, item.id, item.request)

  const options = [
    {
      label: 'Delete',
      icon: Trash2,
      onClick: onDelete,
    },
    {
      label: 'View',
      icon: Eye,
      onClick: () => setSettingsDialogOpen(true),
    },
    {
      label: 'Reuse settings',
      icon: RotateCcw,
      onClick: onReuseSettings,
    },
  ]

  return (
    <div className="group relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-md border bg-background p-2">
      <div className="flex flex-col items-center gap-2 text-center">
        <IconAlertTriangle className="size-6 text-destructive" />
        <span className="text-xs tracking-wide text-destructive">
          {item.error || 'An error occured'}
        </span>
      </div>
      <MediaCardMenu
        className="absolute top-1 right-1 z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
        options={options}
      />
      <RequestSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        request={item.request}
      />
    </div>
  )
}

function StreamingContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-4/3 overflow-hidden rounded-md border bg-background">
        <DotGridLoader circleSize={0.6} dotColor="rgb(212, 255, 0)" />
        <div className='absolute inset-0 flex items-center justify-center px-3'>
        <div className='min-w-0 max-w-full rounded-md px-2 py-1 backdrop-blur-xs'>
            {children}
        </div>
        </div>
    </div>
  )
}

function CompletedMediaCards({
  item,
  projectId,
  selectedAssetIds,
  onSelectedChange,
}: MediaCardRendererProps) {
  if (item.assets.length === 0) {
    return <FailedMediaCard item={item} projectId={projectId} />
  }

  const [singleAsset] = item.assets
  if (item.assets.length === 1 && singleAsset) {
    return (
      <MediaCard
        item={toMediaAsset(singleAsset, item)}
        projectId={projectId}
        selected={selectedAssetIds.includes(singleAsset.id)}
        onSelectedChange={onSelectedChange}
      />
    )
  }

  return (
    <div className="grid aspect-4/3 grid-cols-2 gap-1">
      {item.assets.map((asset) => (
        <MediaCard
          key={asset.id}
          item={toMediaAsset(asset, item)}
          projectId={projectId}
          selected={selectedAssetIds.includes(asset.id)}
          onSelectedChange={onSelectedChange}
        />
      ))}
    </div>
  )
}

function toMediaAsset(asset: AiGeneratedRequestAsset, request: AiGeneratedMediaRequest): MediaAsset {
  return {
    id: asset.id,
    projectId: request.projectId,
    name: asset.name,
    type: asset.type,
    url: asset.url,
    storageKey: asset.storageKey,
    source: 'ai-generated',
    fileNodeId: null,
    metadata: asset.metadata,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    generationRequest: {
      id: request.id,
      status: request.status,
      request: request.request,
      error: request.error,
    },
  }
}

function toRequestAsset(asset: MediaAsset): AiGeneratedRequestAsset {
  return {
    id: asset.id,
    name: asset.name,
    url: asset.url,
    type: asset.type,
    metadata: asset.metadata,
    storageKey: asset.storageKey,
  }
}

const GENERATION_TYPE_ICONS: Record<GenerationType, LucideIcon> = Object.fromEntries(
  GENERATION_TYPES.map(({ value, icon }) => [value, icon]),
) as Record<GenerationType, LucideIcon>

function getRequestGenerationType(request: Record<string, unknown> | null): GenerationType {
  const context = request?.context
  if (!context || typeof context !== 'object') return 'image'
  const value = (context as { generationType?: unknown }).generationType
  if (typeof value !== 'string' || !(value in GENERATION_TYPE_ICONS)) return 'image'
  return value as GenerationType
}

function mergeRequestAssets(
  current: AiGeneratedRequestAsset[],
  incoming: AiGeneratedRequestAsset[],
): AiGeneratedRequestAsset[] {
  const existingIds = new Set(current.map((asset) => asset.id))
  const newAssets = incoming.filter((asset) => !existingIds.has(asset.id))
  return newAssets.length > 0 ? [...current, ...newAssets] : current
}
