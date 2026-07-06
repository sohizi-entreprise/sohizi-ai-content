import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, Edit, FilePlus2, Folder, MoreVertical, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { MediaAsset } from '../requests'
import { buildOptimizeddImageUrl } from '@/utils/transform-url'
import { imageUrlTransforms } from '@/utils/transform-url'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useAssetMenu } from '../hooks/use-asset-menu'
import { toast } from 'sonner'
import { searchFilesByName } from '@/features/projects/request'

type MediaCardProps = {
  item: MediaAsset
  projectId: string
}

export function MediaCard({
  item,
  projectId,
}: MediaCardProps) {

  return (
    <div className='group overflow-hidden rounded-md border aspect-4/3 relative'>
      <RouteMediaAsset item={item} />
      <CardMenu asset={item} projectId={projectId} className='absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300'/>
    </div>
  )
}

function RouteMediaAsset({item}: {item: MediaAsset}) {
  switch (item.type) {
    case 'image':
      return <RenderImage item={item} />
    case 'video':
      return <RenderVideo item={item} />
    case 'audio':
      return <RenderAudio item={item} />
  }
}

function RenderImage({item}: {item: MediaAsset}) {
  const previewUrl = buildOptimizeddImageUrl(item.url, imageUrlTransforms.previews.contentCard);
  const thumbnailUrl = buildOptimizeddImageUrl(item.url, imageUrlTransforms.thumbnails.large);
  const blurryPlaceholderUrl = buildOptimizeddImageUrl(item.url, imageUrlTransforms.blurryPlaceholder);
  return (
    <Dialog>
      <DialogTrigger className='size-full'>
        <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${blurryPlaceholderUrl})` }}>
          <img className='size-full object-contain'
                src={thumbnailUrl}
                alt={item.name}
          />
        </div>
      </DialogTrigger>
      <DialogContent className='md:max-w-6xl bg-surface/30 backdrop-blur-sm' showCloseButton={false}>
        <div className='aspect-video w-full'>
          <img className='size-full object-contain'
                src={previewUrl}
                alt={item.name}
          />
        </div>
        <DialogClose asChild>
          <Button size='icon' className='absolute -top-4 -right-4 rounded-full bg-surface border backdrop-blur-sm hover:bg-surface hover:scale-105 transition-all duration-300'>
            <X className='size-4 text-foreground' />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

function RenderVideo({item}: {item: MediaAsset}) {
  return (
    <div className='size-full'>
      <video className='size-full object-contain'
            src={item.url}
            controls 
      />
    </div>
  )
}
function RenderAudio({item}: {item: MediaAsset}) {
  return (
    <div className='size-full flex items-center justify-center'>
      <audio className='w-11/12 max-w-sm'
            src={item.url}
            controls 
      />
    </div>
  )
}

function CardMenu({
  className,
  asset,
  projectId,
}: {
  className?: string
  asset: MediaAsset
  projectId: string
}) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [folderQuery, setFolderQuery] = useState('')
  const [debouncedFolderQuery, setDebouncedFolderQuery] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const { onDelete, onEdit, onDownload, onMoveToFolder } = useAssetMenu(projectId, asset)
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
      searchFilesByName(projectId, trimmedDebouncedFolderQuery, 25, { signal }),
    enabled: moveDialogOpen && trimmedDebouncedFolderQuery.length > 0,
    staleTime: 1000 * 60,
  })
  const folderOptions = useMemo(
    () => searchedFiles?.filter((file) => file.directory) ?? [],
    [searchedFiles],
  )
  const selectedFolder = folderOptions.find((folder) => folder.id === selectedFolderId)

  const openMoveDialog = () => {
    setFolderQuery('')
    setDebouncedFolderQuery('')
    setSelectedFolderId(null)
    setMoveDialogOpen(true)
  }

  const confirmMove = async () => {
    if (!selectedFolder) return

    const { ok } = await onMoveToFolder(selectedFolder.id)
    if (!ok) {
      toast.error('Failed to move asset')
      return
    }

    toast.success(`Moved ${asset.name} to ${selectedFolder.name}`)
    setMoveDialogOpen(false)
  }

  const options = [
    {
      label: 'Move to folder',
      icon: FilePlus2,
      onClick: openMoveDialog
    },
    {
      label: 'Edit',
      icon: Edit,
      onClick: onEdit
    },
    {
      label: ' Download',
      icon: Download,
      onClick: async() => {
        const { ok } = await onDownload()
        if(!ok){
          toast.error('Failed to download asset')
        }
      }
    },
    {
      label: 'Delete',
      icon: Trash2,
      onClick:  onDelete
    },
  ]




  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              'rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 hover:text-white',
              className,
            )}
            aria-label="Media actions"
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-white/10 bg-black/90 text-white backdrop-blur-xl"
        >
          {
            options.map((option) => (
              <DropdownMenuItem key={option.label} onClick={option.onClick}>
                <option.icon className="size-4" />
                {option.label}
              </DropdownMenuItem>
            ))
          }
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription>
              Search for a folder and confirm where this asset should be moved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={folderQuery}
              onChange={(event) => {
                setFolderQuery(event.target.value)
                setSelectedFolderId(null)
              }}
              placeholder="Search folders..."
            />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!selectedFolder} onClick={confirmMove}>
              Confirm move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
