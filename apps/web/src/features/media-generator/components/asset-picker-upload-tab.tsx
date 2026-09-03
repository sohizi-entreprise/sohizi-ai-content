import { useRef } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@sohizi/ui/button"
import { listUploadedAssetsQueryOptions } from "../query-mutations"
import {
  acceptForFileTypes,
  describeFileTypes,
  isPickerAssetType,
  queryTypeForFileTypes,
} from "../lib/parameter-assets"
import { AssetPickerGrid } from "./asset-picker-grid"
import type { PickerAsset, PickerAssetType } from "../lib/parameter-assets"
import { useSaveFileBucket } from "@/hooks/use-save-file-bucket"

type AssetPickerUploadTabProps = {
  projectId: string
  fileTypes: Array<PickerAssetType>
  selectedUrls: Array<string>
  onSelect: (asset: PickerAsset) => void
  maxItems: number
  allowMultiple: boolean
}

export function AssetPickerUploadTab({
  projectId,
  fileTypes,
  selectedUrls,
  onSelect,
  maxItems,
  allowMultiple,
}: AssetPickerUploadTabProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const { saveFile, isUploading } = useSaveFileBucket()
  const accept = acceptForFileTypes(fileTypes)
  const queryType = queryTypeForFileTypes(fileTypes)

  const {
    data: uploadedAssets = [],
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery(
    listUploadedAssetsQueryOptions(
      projectId,
      queryType ? { type: queryType } : undefined,
    ),
  )

  const allowed = new Set(fileTypes)
  const items: Array<PickerAsset> = uploadedAssets.flatMap((asset) => {
    if (!isPickerAssetType(asset.type) || !allowed.has(asset.type)) return []
    return [
      {
        id: asset.id,
        name: asset.name,
        url: asset.url,
        type: asset.type,
      },
    ]
  })

  const handleFiles = (fileList: FileList | null) => {
    const file = fileList?.[0]
    if (!file) return

    saveFile(
      { projectId, folderId: null, file },
      {
        onSuccess: (result) => {
          void queryClient.invalidateQueries({
            queryKey: ["media", projectId, "uploaded-assets"],
          })
          const uploadedType = result.asset.type
          if (isPickerAssetType(uploadedType) && allowed.has(uploadedType)) {
            onSelect({
              id: result.asset.id,
              name: result.asset.name,
              url: result.asset.url,
              type: uploadedType,
            })
            return
          }
          toast.error(`Only ${describeFileTypes(fileTypes)} files are allowed`)
        },
        onError: (error) => {
          toast.error(error.message)
        },
      },
    )

    if (inputRef.current) {
      inputRef.current.value = ""
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
          {isUploading ? "Uploading..." : "Upload from device"}
        </Button>
      </div>
      <AssetPickerGrid
        items={items}
        selectedUrls={selectedUrls}
        onSelect={onSelect}
        maxItems={maxItems}
        allowMultiple={allowMultiple}
        isLoading={isLoading}
        emptyLabel={`No uploaded ${describeFileTypes(fileTypes)} files yet`}
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
