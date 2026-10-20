import { useEffect, useState } from "react"
import { ImagePlus, Music, Video, X } from "lucide-react"
import { Button } from "@sohizi/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sohizi/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sohizi/ui/tabs"
import {
  chooseLabelForFileTypes,
  describeFileTypes,
  getMaxAssetItems,
  getUploaderFileTypes,
  isArrayParameter,
  parseParameterAssetUrls,
  serializeParameterAssetUrls,
} from "../lib/parameter-assets"
import { AssetPickerFolderTab } from "./asset-picker-folder-tab"
import { AssetPickerGeneratedTab } from "./asset-picker-generated-tab"
import { AssetPickerUploadTab } from "./asset-picker-upload-tab"
import type { PickerAsset, PickerAssetType } from "../lib/parameter-assets"
import type { ModelParameterBinding } from "@/features/admin/types"
import { cn } from "@/lib/utils"
import { thumbnailImageUrl } from "@/utils/transform-url"

type SelectedAsset = {
  url: string
  type: PickerAssetType
}

type SharedAssetPickerProps = {
  projectId: string
  label: string
  fileTypes: Array<PickerAssetType>
  maxItems: number
  allowMultiple: boolean
  value: string
  onChange: (value: string) => void
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
}: SharedAssetPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = parsePickerValue(value, fileTypes)
  const chooseLabel = chooseLabelForFileTypes(fileTypes, allowMultiple)
  const EmptyIcon = emptyIconForFileTypes(fileTypes)

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
                <EmptyIcon className="size-4 text-muted-foreground" />
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
            onClick={() => onChange(serializePickerValue([], allowMultiple))}
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
      />
    </>
  )
}

function SelectedThumbnails({ items }: { items: Array<SelectedAsset> }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex">
        {items.slice(0, 3).map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className={cn(
              "size-12 overflow-hidden rounded-lg border bg-muted",
              index > 0 && "-ml-3",
            )}
            style={{ zIndex: items.length - index }}
          >
            <ReferenceThumbnail item={item} />
          </div>
        ))}
      </div>
      <span className="truncate text-xs text-muted-foreground">
        {items.length} {items.length === 1 ? "file" : "files"} selected
      </span>
    </div>
  )
}

function ReferenceThumbnail({ item }: { item: SelectedAsset }) {
  if (item.type === "image") {
    return (
      <img
        src={thumbnailImageUrl(item.url)}
        alt=""
        className="size-full object-cover"
      />
    )
  }

  if (item.type === "video") {
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
}: SharedAssetPickerProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [draftItems, setDraftItems] = useState<Array<SelectedAsset>>([])
  const selectedUrls = draftItems.map((item) => item.url)
  const fileTypeLabel = describeFileTypes(fileTypes)
  const fileTypesKey = fileTypes.join(",")

  useEffect(() => {
    if (open) {
      setDraftItems(parsePickerValue(value, fileTypes))
    }
  }, [fileTypesKey, open, value])

  const applySelection = (items: Array<SelectedAsset>) => {
    onChange(serializePickerValue(items, allowMultiple))
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
              ? `Select up to ${Number.isFinite(maxItems) ? maxItems : "any number of"} ${fileTypeLabel} files.`
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
              Add{" "}
              {draftItems.length > 0
                ? `(${draftItems.length}${Number.isFinite(maxItems) ? ` / ${maxItems}` : ""})`
                : ""}
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
): Array<SelectedAsset> {
  const fallbackType = fileTypes[0] ?? "image"
  return parseParameterAssetUrls(value).map((url) => ({
    url,
    type: fallbackType,
  }))
}

function serializePickerValue(
  items: Array<SelectedAsset>,
  allowMultiple: boolean,
): string {
  return serializeParameterAssetUrls(
    items.map((item) => item.url),
    allowMultiple,
  )
}

function emptyIconForFileTypes(fileTypes: Array<PickerAssetType>) {
  if (fileTypes.length === 1 && fileTypes[0] === "video") return Video
  if (fileTypes.length === 1 && fileTypes[0] === "audio") return Music
  return ImagePlus
}
