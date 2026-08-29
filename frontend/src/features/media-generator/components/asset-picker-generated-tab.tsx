import { useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listAiGeneratedAssetsQueryOptions } from '../query-mutations'
import {
  describeFileTypes,
  isPickerAssetType,
  queryTypeForFileTypes,
} from '../lib/parameter-assets'
import { AssetPickerGrid } from './asset-picker-grid'
import type { PickerAsset, PickerAssetType } from '../lib/parameter-assets'

type AssetPickerGeneratedTabProps = {
  projectId: string
  fileTypes: Array<PickerAssetType>
  selectedUrls: Array<string>
  onSelect: (asset: PickerAsset) => void
  maxItems: number
  allowMultiple: boolean
}

export function AssetPickerGeneratedTab({
  projectId,
  fileTypes,
  selectedUrls,
  onSelect,
  maxItems,
  allowMultiple,
}: AssetPickerGeneratedTabProps) {
  const queryType = queryTypeForFileTypes(fileTypes)
  const {
    data: requests = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    listAiGeneratedAssetsQueryOptions(
      projectId,
      queryType ? { type: queryType } : undefined,
    ),
  )

  const items = useMemo<Array<PickerAsset>>(() => {
    const allowed = new Set(fileTypes)
    return requests.flatMap((request) =>
      request.assets.flatMap((asset) => {
        if (
          !asset.url ||
          !isPickerAssetType(asset.type) ||
          !allowed.has(asset.type)
        )
          return []
        return [
          {
            id: asset.id,
            name: asset.name,
            url: asset.url,
            type: asset.type,
          },
        ]
      }),
    )
  }, [fileTypes, requests])

  return (
    <AssetPickerGrid
      items={items}
      selectedUrls={selectedUrls}
      onSelect={onSelect}
      maxItems={maxItems}
      allowMultiple={allowMultiple}
      isLoading={isLoading}
      emptyLabel={`No generated ${describeFileTypes(fileTypes)} files yet`}
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
