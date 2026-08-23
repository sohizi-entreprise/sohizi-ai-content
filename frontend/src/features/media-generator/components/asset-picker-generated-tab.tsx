import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listAiGeneratedAssetsQueryOptions } from '../query-mutations'
import { AssetPickerGrid } from './asset-picker-grid'
import type { PickerAsset, PickerAssetType } from '../lib/parameter-assets'

type AssetPickerGeneratedTabProps = {
  projectId: string
  fileType: PickerAssetType
  selectedUrls: string[]
  onSelect: (asset: PickerAsset) => void
  maxItems: number
  allowMultiple: boolean
}

export function AssetPickerGeneratedTab({
  projectId,
  fileType,
  selectedUrls,
  onSelect,
  maxItems,
  allowMultiple,
}: AssetPickerGeneratedTabProps) {
  const {
    data: requests = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(listAiGeneratedAssetsQueryOptions(projectId, { type: fileType }))

  const items = useMemo<PickerAsset[]>(() => {
    return requests.flatMap((request) =>
      request.assets
        .filter((asset) => asset.url && asset.type === fileType)
        .map((asset) => ({
          id: asset.id,
          name: asset.name,
          url: asset.url,
          type: fileType,
        })),
    )
  }, [fileType, requests])

  return (
    <AssetPickerGrid
      items={items}
      selectedUrls={selectedUrls}
      onSelect={onSelect}
      maxItems={maxItems}
      allowMultiple={allowMultiple}
      isLoading={isLoading}
      emptyLabel={`No generated ${fileType} files yet`}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      onLoadMore={() => {
        if (hasNextPage && !isFetchingNextPage) {
          void fetchNextPage()
        }
      }}
    />
  )
}
