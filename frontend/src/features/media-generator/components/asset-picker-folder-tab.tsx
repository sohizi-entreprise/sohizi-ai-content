import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Folder } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { searchFilesByName } from '@/features/projects/request'
import { listFolderMediaQueryOptions } from '@/features/projects/query-mutation'
import { AssetPickerGrid } from './asset-picker-grid'
import {
  describeFileTypes,
  isPickerAssetType,
  queryTypeForFileTypes,
  type PickerAsset,
  type PickerAssetType,
} from '../lib/parameter-assets'

type AssetPickerFolderTabProps = {
  projectId: string
  fileTypes: PickerAssetType[]
  selectedUrls: string[]
  onSelect: (asset: PickerAsset) => void
  maxItems: number
  allowMultiple: boolean
}

export function AssetPickerFolderTab({
  projectId,
  fileTypes,
  selectedUrls,
  onSelect,
  maxItems,
  allowMultiple,
}: AssetPickerFolderTabProps) {
  const [folderQuery, setFolderQuery] = useState('')
  const [debouncedFolderQuery, setDebouncedFolderQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const trimmedFolderQuery = folderQuery.trim()
  const trimmedDebouncedFolderQuery = debouncedFolderQuery.trim()

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFolderQuery(trimmedFolderQuery)
    }, 250)
    return () => window.clearTimeout(timeoutId)
  }, [trimmedFolderQuery])

  const { data: searchedFiles, isFetching: isSearchingFolders } = useQuery({
    queryKey: ['project', projectId, 'folder-search', trimmedDebouncedFolderQuery],
    queryFn: ({ signal }) =>
      searchFilesByName(projectId, trimmedDebouncedFolderQuery, 25, {
        signal,
        directory: true,
      }),
    enabled: trimmedDebouncedFolderQuery.length > 0,
    staleTime: 1000 * 60,
  })

  const folderOptions = useMemo(() => searchedFiles ?? [], [searchedFiles])
  const selectedFolder = folderOptions.find((folder) => folder.id === selectedFolderId)

  const queryType = queryTypeForFileTypes(fileTypes)
  const { data: folderFiles = [], isLoading: isLoadingFolderFiles } = useQuery(
    listFolderMediaQueryOptions(projectId, selectedFolderId, queryType ? { format: queryType } : undefined),
  )

  const allowed = new Set(fileTypes)
  const items: PickerAsset[] = folderFiles.flatMap((file) => {
    if (!isPickerAssetType(file.type) || !allowed.has(file.type) || !file.url) return []
    return [{
      id: file.id,
      name: file.name,
      url: file.url,
      type: file.type,
    }]
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Input
        value={folderQuery}
        onChange={(event) => {
          setFolderQuery(event.target.value)
          setSelectedFolderId(null)
        }}
        placeholder="Search folders..."
      />

      {!selectedFolder ? (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
          {folderOptions.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {!trimmedDebouncedFolderQuery
                ? 'Start typing to search folders'
                : isSearchingFolders
                  ? 'Searching folders...'
                  : 'No folders found'}
            </div>
          ) : (
            folderOptions.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setSelectedFolderId(folder.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  selectedFolderId === folder.id && 'bg-accent text-accent-foreground',
                )}
              >
                <Folder className="size-4 text-muted-foreground" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setSelectedFolderId(null)}
            className="text-left text-xs text-muted-foreground hover:text-foreground"
          >
            Back to folders · {selectedFolder.name}
          </button>
          <AssetPickerGrid
            items={items}
            selectedUrls={selectedUrls}
            onSelect={onSelect}
            maxItems={maxItems}
            allowMultiple={allowMultiple}
            isLoading={isLoadingFolderFiles}
            emptyLabel={`No ${describeFileTypes(fileTypes)} files in this folder`}
          />
        </>
      )}
    </div>
  )
}
