import { useRef } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSaveFileBucket } from '@/hooks/use-save-file-bucket'
import { listUploadedAssetsQueryOptions } from '../query-mutations'
import { AssetPickerGrid } from './asset-picker-grid'
import type { PickerAsset, PickerAssetType } from '../lib/parameter-assets'

type AssetPickerUploadTabProps = {
  projectId: string
  fileType: PickerAssetType
  selectedUrls: string[]
  onSelect: (asset: PickerAsset) => void
  maxItems: number
  allowMultiple: boolean
}

export function AssetPickerUploadTab({
  projectId,
  fileType,
  selectedUrls,
  onSelect,
  maxItems,
  allowMultiple,
}: AssetPickerUploadTabProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { saveFile, isUploading } = useSaveFileBucket()
  const accept =
    fileType === 'video' ? 'video/*' : fileType === 'audio' ? 'audio/*' : 'image/*'

  const {
    data: uploadedAssets = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(listUploadedAssetsQueryOptions(projectId, { type: fileType }))

  const items: PickerAsset[] = uploadedAssets
    .filter((asset) => asset.type === fileType)
    .map((asset) => ({
      id: asset.id,
      name: asset.name,
      url: asset.url,
      type: fileType,
    }))

  const handleFiles = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    saveFile({ projectId, folderId: null, file }, {
      onSuccess: (result) => {
        void queryClient.invalidateQueries({
          queryKey: ['media', projectId, 'uploaded-assets'],
        })
        const uploadedType = result.asset.type
        if (uploadedType === 'image' || uploadedType === 'video' || uploadedType === 'audio') {
          onSelect({
            id: result.asset.id,
            name: result.asset.name,
            url: result.asset.url,
            type: uploadedType,
          })
        }
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex justify-end">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {isUploading ? 'Uploading...' : 'Upload from device'}
        </Button>
      </div>
      <AssetPickerGrid
        items={items}
        selectedUrls={selectedUrls}
        onSelect={onSelect}
        maxItems={maxItems}
        allowMultiple={allowMultiple}
        isLoading={isLoading}
        emptyLabel={`No uploaded ${fileType} files yet`}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={() => {
          if (hasNextPage && !isFetchingNextPage) {
            void fetchNextPage()
          }
        }}
      />
    </div>
  )
}
