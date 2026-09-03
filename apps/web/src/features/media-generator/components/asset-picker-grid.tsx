import { useCallback, useEffect, useRef } from "react"
import { IconLoader2 } from "@tabler/icons-react"
import { Check, Music } from "lucide-react"
import type { PickerAsset } from "../lib/parameter-assets"
import { cn } from "@/lib/utils"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"

type AssetPickerGridProps = {
  items: Array<PickerAsset>
  selectedUrls: Array<string>
  onSelect: (asset: PickerAsset) => void
  maxItems: number
  allowMultiple: boolean
  isLoading?: boolean
  emptyLabel: string
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  onLoadMore?: () => void
}

export function AssetPickerGrid({
  items,
  selectedUrls,
  onSelect,
  maxItems,
  allowMultiple,
  isLoading,
  emptyLabel,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: AssetPickerGridProps) {
  const selected = new Set(selectedUrls)
  const atLimit = allowMultiple && selectedUrls.length >= maxItems

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-3 gap-4 p-2 sm:grid-cols-4">
        {items.map((item) => {
          const isSelected = selected.has(item.url)
          const disabled = atLimit && !isSelected

          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(item)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border bg-muted text-left transition-colors",
                isSelected &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <PickerPreview asset={item} />
              {isSelected ? (
                <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {onLoadMore ? (
        <InfiniteScrollSentinel
          enabled={Boolean(hasNextPage)}
          isFetching={Boolean(isFetchingNextPage)}
          onLoadMore={onLoadMore}
        />
      ) : null}
    </div>
  )
}

function PickerPreview({ asset }: { asset: PickerAsset }) {
  if (asset.type === "image") {
    const thumbnailUrl = buildOptimizeddImageUrl(
      asset.url,
      imageUrlTransforms.thumbnails.small,
    )
    return (
      <img
        src={thumbnailUrl}
        alt={asset.name}
        className="size-full object-cover"
      />
    )
  }

  if (asset.type === "video") {
    return (
      <video
        src={asset.url}
        muted
        playsInline
        preload="metadata"
        className="size-full object-cover"
      />
    )
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 px-2 text-muted-foreground">
      <Music className="size-5" />
      <span className="line-clamp-2 text-center text-[11px]">{asset.name}</span>
    </div>
  )
}

function InfiniteScrollSentinel({
  enabled,
  isFetching,
  onLoadMore,
}: {
  enabled: boolean
  isFetching: boolean
  onLoadMore: () => void
}) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  const handleLoadMore = useCallback(() => {
    if (!enabled || isFetching) return
    onLoadMore()
  }, [enabled, isFetching, onLoadMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          handleLoadMore()
        }
      },
      { rootMargin: "120px 0px 0px 0px", threshold: 0 },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [handleLoadMore])

  return (
    <div
      ref={sentinelRef}
      className="flex justify-center py-3"
    >
      {isFetching ? (
        <IconLoader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <div className="h-1" />
      )}
    </div>
  )
}
