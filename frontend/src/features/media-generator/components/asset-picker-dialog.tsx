import { useEffect, useState } from 'react'
import { ImagePlus, Music, X } from 'lucide-react'
import {
  describeFileTypes,
  getMaxAssetItems,
  getUploaderFileTypes,
  isArrayParameter,
  parseParameterAssetUrls,
  serializeParameterAssetUrls,
} from '../lib/parameter-assets'
import {
  parseAgentReferences,
  serializeAgentReferences,
} from '../lib/agent-settings'
import { AssetPickerFolderTab } from './asset-picker-folder-tab'
import { AssetPickerGeneratedTab } from './asset-picker-generated-tab'
import { AssetPickerUploadTab } from './asset-picker-upload-tab'
import type { PickerAsset, PickerAssetType } from '../lib/parameter-assets'
import type { ModelParameterBinding } from '@/features/admin/types'
import type { AgentReference } from '../lib/agent-settings'
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
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from '@/utils/transform-url'

type AssetPickerValueFormat = 'urls' | 'references'

type SharedAssetPickerProps = {
  projectId: string
  label: string
  fileTypes: Array<PickerAssetType>
  maxItems: number
  allowMultiple: boolean
  value: string
  onChange: (value: string) => void
  valueFormat: AssetPickerValueFormat
}

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
  return (
    <SharedAssetPicker
      projectId={projectId}
      label={parameter.label}
      fileTypes={getUploaderFileTypes(parameter)}
      maxItems={getMaxAssetItems(parameter)}
      allowMultiple={isArrayParameter(parameter)}
      value={value}
      onChange={onChange}
      valueFormat="urls"
    />
  )
}

export function ReferenceAssetPickerField({
  projectId,
  label,
  fileTypes,
  maxItems,
  value,
  onChange,
}: {
  projectId: string
  label: string
  fileTypes: Array<PickerAssetType>
  maxItems: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <SharedAssetPicker
      projectId={projectId}
      label={label}
      fileTypes={fileTypes}
      maxItems={maxItems}
      allowMultiple
      value={value}
      onChange={onChange}
      valueFormat="references"
    />
  )
}

function SharedAssetPicker({
  projectId,
  label,
  fileTypes,
  maxItems,
  allowMultiple,
  value,
  onChange,
  valueFormat,
}: SharedAssetPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parsePickerValue(value, fileTypes, valueFormat)
  const chooseLabel =
    fileTypes.length === 1
      ? `${fileTypes[0]}${allowMultiple ? 's' : ''}`
      : 'files'

  return (
    <>
      <div className="flex min-h-20 items-center gap-3 rounded-xl border border-dashed px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {selected.length > 0 ? (
            <SelectedThumbnails items={selected} />
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-lg border border-dashed">
                <ImagePlus className="size-4 text-muted-foreground" />
              </span>
              <span className="text-xs text-muted-foreground">
                Choose {chooseLabel}
              </span>
            </>
          )}
        </button>
        {selected.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              onChange(serializePickerValue([], allowMultiple, valueFormat))
            }
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
        label={label}
        fileTypes={fileTypes}
        maxItems={maxItems}
        allowMultiple={allowMultiple}
        value={value}
        onChange={onChange}
        valueFormat={valueFormat}
      />
    </>
  )
}

function SelectedThumbnails({ items }: { items: Array<AgentReference> }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex">
        {items.slice(0, 3).map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className={cn(
              'size-12 overflow-hidden rounded-lg border bg-muted',
              index > 0 && '-ml-3',
            )}
            style={{ zIndex: items.length - index }}
          >
            <ReferenceThumbnail item={item} />
          </div>
        ))}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {items.length} {items.length === 1 ? 'file' : 'files'} selected
      </span>
    </div>
  )
}

function ReferenceThumbnail({ item }: { item: AgentReference }) {
  if (item.type === 'image') {
    return (
      <img
        src={buildOptimizeddImageUrl(
          item.url,
          imageUrlTransforms.thumbnails.small,
        )}
        alt=""
        className="size-full object-cover"
      />
    )
  }

  if (item.type === 'video') {
    return (
      <video
        src={item.url}
        muted
        playsInline
        preload="metadata"
        className="size-full object-cover"
      />
    )
  }

  return (
    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
      <Music className="size-4" />
    </div>
  )
}

function AssetPickerDialog({
  open,
  onOpenChange,
  projectId,
  label,
  fileTypes,
  maxItems,
  allowMultiple,
  value,
  onChange,
  valueFormat,
}: SharedAssetPickerProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draftItems, setDraftItems] = useState<Array<AgentReference>>([])
  const selectedUrls = draftItems.map((item) => item.url)
  const fileTypeLabel = describeFileTypes(fileTypes)
  const fileTypesKey = fileTypes.join(',')

  useEffect(() => {
    if (open) {
      setDraftItems(parsePickerValue(value, fileTypes, valueFormat))
    }
  }, [fileTypesKey, open, value, valueFormat])

  const applySelection = (items: Array<AgentReference>) => {
    onChange(serializePickerValue(items, allowMultiple, valueFormat))
    onOpenChange(false)
  }

  const handleSelect = (asset: PickerAsset) => {
    const nextItem = { url: asset.url, type: asset.type }
    if (!allowMultiple) {
      applySelection([nextItem])
      return
    }

    setDraftItems((current) => {
      if (current.some((item) => item.url === asset.url)) {
        return current.filter((item) => item.url !== asset.url)
      }
      if (current.length >= maxItems) {
        return current
      }
      return [...current, nextItem]
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden md:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose {label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            {allowMultiple
              ? `Select up to ${Number.isFinite(maxItems) ? maxItems : 'any number of'} ${fileTypeLabel} files.`
              : `Select one ${fileTypeLabel}.`}
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
              fileTypes={fileTypes}
              selectedUrls={selectedUrls}
              onSelect={handleSelect}
              maxItems={maxItems}
              allowMultiple={allowMultiple}
            />
          </TabsContent>
          <TabsContent value="upload" className="flex min-h-0 flex-1 flex-col">
            <AssetPickerUploadTab
              projectId={projectId}
              fileTypes={fileTypes}
              selectedUrls={selectedUrls}
              onSelect={handleSelect}
              maxItems={maxItems}
              allowMultiple={allowMultiple}
            />
          </TabsContent>
          <TabsContent
            value="generated"
            className="flex min-h-0 flex-1 flex-col"
          >
            <AssetPickerGeneratedTab
              projectId={projectId}
              fileTypes={fileTypes}
              selectedUrls={selectedUrls}
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
              disabled={draftItems.length === 0}
              onClick={() => applySelection(draftItems)}
            >
              Add{' '}
              {draftItems.length > 0
                ? `(${draftItems.length}${Number.isFinite(maxItems) ? ` / ${maxItems}` : ''})`
                : ''}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function parsePickerValue(
  value: string,
  fileTypes: Array<PickerAssetType>,
  valueFormat: AssetPickerValueFormat,
): Array<AgentReference> {
  if (valueFormat === 'references') {
    const allowed = new Set(fileTypes)
    return parseAgentReferences(value).filter((item) => allowed.has(item.type))
  }

  const fallbackType = fileTypes[0] ?? 'image'
  return parseParameterAssetUrls(value).map((url) => ({
    url,
    type: fallbackType,
  }))
}

function serializePickerValue(
  items: Array<AgentReference>,
  allowMultiple: boolean,
  valueFormat: AssetPickerValueFormat,
): string {
  if (valueFormat === 'references') {
    return serializeAgentReferences(allowMultiple ? items : items.slice(0, 1))
  }

  return serializeParameterAssetUrls(
    items.map((item) => item.url),
    allowMultiple,
  )
}
