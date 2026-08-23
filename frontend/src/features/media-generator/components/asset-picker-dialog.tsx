import { useEffect, useState } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { buildOptimizeddImageUrl, imageUrlTransforms } from '@/utils/transform-url'
import type { ModelParameterBinding } from '@/features/admin/types'
import {
  getMaxAssetItems,
  getUploaderFileType,
  isArrayParameter,
  parseParameterAssetUrls,
  serializeParameterAssetUrls,
  type PickerAsset,
} from '../lib/parameter-assets'
import { AssetPickerFolderTab } from './asset-picker-folder-tab'
import { AssetPickerGeneratedTab } from './asset-picker-generated-tab'
import { AssetPickerUploadTab } from './asset-picker-upload-tab'

type AssetPickerFieldProps = {
  projectId: string
  parameter: ModelParameterBinding
  value: string
  onChange: (value: string) => void
}

export function AssetPickerField({
  projectId,
  parameter,
  value,
  onChange,
}: AssetPickerFieldProps) {
  const [open, setOpen] = useState(false)
  const fileType = getUploaderFileType(parameter)
  const allowMultiple = isArrayParameter(parameter)
  const selectedUrls = parseParameterAssetUrls(value)

  return (
    <>
      <div className="flex min-h-20 items-center gap-3 rounded-xl border border-dashed px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {selectedUrls.length > 0 ? (
            <SelectedThumbnails urls={selectedUrls} fileType={fileType} />
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-lg border border-dashed">
                <ImagePlus className="size-4 text-muted-foreground" />
              </span>
              <span className="text-xs text-muted-foreground">
                Choose {fileType}{allowMultiple ? 's' : ''}
              </span>
            </>
          )}
        </button>
        {selectedUrls.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onChange(allowMultiple ? '[]' : '')}
            aria-label="Clear selected assets"
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>

      <AssetPickerDialog
        open={open}
        onOpenChange={setOpen}
        projectId={projectId}
        parameter={parameter}
        value={value}
        onChange={onChange}
      />
    </>
  )
}

function SelectedThumbnails({
  urls,
  fileType,
}: {
  urls: string[]
  fileType: ReturnType<typeof getUploaderFileType>
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex">
        {urls.slice(0, 3).map((url, index) => (
          <div
            key={`${url}-${index}`}
            className={cn(
              'size-12 overflow-hidden rounded-lg border bg-muted',
              index > 0 && '-ml-3',
            )}
            style={{ zIndex: urls.length - index }}
          >
            {fileType === 'image' ? (
              <img
                src={buildOptimizeddImageUrl(url, imageUrlTransforms.thumbnails.small)}
                alt=""
                className="size-full object-cover"
              />
            ) : fileType === 'video' ? (
              <video src={url} muted playsInline preload="metadata" className="size-full object-cover" />
            ) : (
              <div className="size-full bg-muted" />
            )}
          </div>
        ))}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {urls.length} {fileType}{urls.length === 1 ? '' : 's'} selected
      </span>
    </div>
  )
}

function AssetPickerDialog({
  open,
  onOpenChange,
  projectId,
  parameter,
  value,
  onChange,
}: AssetPickerFieldProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const fileType = getUploaderFileType(parameter)
  const allowMultiple = isArrayParameter(parameter)
  const maxItems = getMaxAssetItems(parameter)
  const [draftUrls, setDraftUrls] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setDraftUrls(parseParameterAssetUrls(value))
    }
  }, [open, value])

  const applySelection = (urls: string[]) => {
    onChange(serializeParameterAssetUrls(urls, allowMultiple))
    onOpenChange(false)
  }

  const handleSelect = (asset: PickerAsset) => {
    if (!allowMultiple) {
      applySelection([asset.url])
      return
    }

    setDraftUrls((current) => {
      if (current.includes(asset.url)) {
        return current.filter((url) => url !== asset.url)
      }
      if (current.length >= maxItems) {
        return current
      }
      return [...current, asset.url]
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose {parameter.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {allowMultiple
              ? `Select up to ${Number.isFinite(maxItems) ? maxItems : 'any number of'} ${fileType} files.`
              : `Select one ${fileType}.`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="folder" className="flex min-h-0 flex-1 flex-col">
          <TabsList>
            <TabsTrigger value="folder">From a folder</TabsTrigger>
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="generated">From generated</TabsTrigger>
          </TabsList>
          <TabsContent value="folder" className="flex min-h-0 flex-1 flex-col">
            <AssetPickerFolderTab
              projectId={projectId}
              fileType={fileType}
              selectedUrls={draftUrls}
              onSelect={handleSelect}
              maxItems={maxItems}
              allowMultiple={allowMultiple}
            />
          </TabsContent>
          <TabsContent value="upload" className="flex min-h-0 flex-1 flex-col">
            <AssetPickerUploadTab
              projectId={projectId}
              fileType={fileType}
              selectedUrls={draftUrls}
              onSelect={handleSelect}
              maxItems={maxItems}
              allowMultiple={allowMultiple}
            />
          </TabsContent>
          <TabsContent value="generated" className="flex min-h-0 flex-1 flex-col">
            <AssetPickerGeneratedTab
              projectId={projectId}
              fileType={fileType}
              selectedUrls={draftUrls}
              onSelect={handleSelect}
              maxItems={maxItems}
              allowMultiple={allowMultiple}
            />
          </TabsContent>
        </Tabs>

        {allowMultiple ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={draftUrls.length === 0}
              onClick={() => applySelection(draftUrls)}
            >
              Add {draftUrls.length > 0 ? `(${draftUrls.length}${Number.isFinite(maxItems) ? ` / ${maxItems}` : ''})` : ''}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
