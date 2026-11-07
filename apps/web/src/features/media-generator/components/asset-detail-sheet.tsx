import {
  Copy,
  Download,
  Folder,
  Link2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@sohizi/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@sohizi/ui/sheet"
import { getGenerationDetails } from "../lib/request-state"
import type { ReactNode } from "react"
import type { MediaAsset } from "../requests"
import {
  buildOptimizeddImageUrl,
  imageUrlTransforms,
} from "@/utils/transform-url"

type AssetDetailSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset?: MediaAsset
  request?: Record<string, unknown> | null
  credits?: number | null
  error?: string | null
  onMove?: () => void
  onDownload?: () => void
  onCopyLink?: () => void
  onDelete?: () => void
  onReuse: () => void
  children?: ReactNode
}

export function AssetDetailSheet({
  open,
  onOpenChange,
  asset,
  request,
  credits,
  error,
  onMove,
  onDownload,
  onCopyLink,
  onDelete,
  onReuse,
  children,
}: AssetDetailSheetProps) {
  const resolvedRequest = request ?? asset?.generationRequest?.request ?? null
  const resolvedCredits = credits ?? asset?.generationRequest?.credits ?? null
  const resolvedError = error ?? asset?.generationRequest?.error ?? null
  const normalizedError =
    typeof resolvedError === "string" && resolvedError.trim().length > 0
      ? resolvedError.trim()
      : null
  const details = getGenerationDetails(resolvedRequest, {
    credits: resolvedCredits,
    error: normalizedError,
  })
  const showMediaStage =
    asset != null && (asset.type === "image" || asset.type === "video")

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90vh] max-h-[90vh] gap-0 rounded-t-3xl border-t p-0 bg-surface"
        showCloseButton={false}
      >
        <SheetHeader className="sticky top-0 z-10 shrink-0 flex-row items-center rounded-t-3xl justify-end gap-2 border-b px-4 py-3 pr-14">
          <SheetTitle className="sr-only">Generation details</SheetTitle>
          <SheetDescription className="sr-only">
            Preview this generated asset and the settings used to create it.
          </SheetDescription>
          {onMove ? (
            <HeaderAction icon={Folder} label="Move" onClick={onMove} />
          ) : null}
          {onDownload ? (
            <HeaderAction
              icon={Download}
              label="Download"
              onClick={onDownload}
            />
          ) : null}
          {onCopyLink ? (
            <HeaderAction icon={Link2} label="Copy link" onClick={onCopyLink} />
          ) : null}
          <HeaderAction icon={RotateCcw} label="Reuse" onClick={onReuse} />
          {onDelete ? (
            <HeaderAction icon={Trash2} label="Delete" onClick={onDelete} />
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {showMediaStage ? <AssetMediaStage asset={asset} /> : null}
          <div className="mx-auto w-full max-w-5xl space-y-8 px-5 py-8 sm:px-8">
            {details ? (
              <GenerationDetails details={details} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  No settings were stored for this request.
                </p>
                {normalizedError ? (
                  <GenerationErrorSection error={normalizedError} />
                ) : null}
              </>
            )}
          </div>
        </div>
        {children}
        <SheetClose asChild>
          <Button
            size="icon"
            className="absolute right-4 -top-10 z-10 rounded-full cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  )
}

function HeaderAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Folder
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Icon className="size-4" />
      {label}
    </Button>
  )
}

function AssetMediaStage({ asset }: { asset: MediaAsset }) {
  const previewUrl = buildOptimizeddImageUrl(
    asset.url,
    imageUrlTransforms.previews.contentCard,
  )

  return (
    <div className="flex h-[min(60vh,600px)] items-center justify-center bg-black/40 px-4 py-6">
      {asset.type === "video" ? (
        <video
          className="max-h-full max-w-full rounded-xl object-contain"
          src={asset.url}
          controls
          autoPlay
          playsInline
        />
      ) : (
        <img
          className="max-h-full max-w-full rounded-xl object-contain"
          src={previewUrl}
          alt=""
        />
      )}
    </div>
  )
}

function GenerationDetails({
  details,
}: {
  details: NonNullable<ReturnType<typeof getGenerationDetails>>
}) {
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(details.prompt)
      toast.success("Prompt copied")
    } catch {
      toast.error("Failed to copy prompt")
    }
  }

  return (
    <div className="space-y-8">
      {details.prompt ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <SectionLabel>Prompt</SectionLabel>
            <Button
              variant="ghost"
              onClick={copyPrompt}
              className="cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
          <div className="">
            <p className="whitespace-pre-wrap text-base leading-7 text-foreground">
              {details.prompt}
            </p>
          </div>
        </section>
      ) : null}

      {details.meta.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Generation</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {details.meta.map((tile) => (
              <DetailTile
                key={tile.label}
                label={tile.label}
                value={tile.value}
              />
            ))}
          </div>
        </section>
      ) : null}

      {details.parameters.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Settings</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {details.parameters.map((tile) => (
              <DetailTile
                key={`${tile.label}-${tile.value}`}
                label={tile.label}
                value={tile.value}
              />
            ))}
          </div>
        </section>
      ) : null}

      {details.references.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>References</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            {details.references.map((reference, index) => (
              <ReferenceCard
                key={`${reference.url}-${index}`}
                label={reference.label}
                url={reference.url}
                type={reference.type}
              />
            ))}
          </div>
        </section>
      ) : null}

      {details.error ? <GenerationErrorSection error={details.error} /> : null}
    </div>
  )
}

function GenerationErrorSection({ error }: { error: string }) {
  return (
    <section className="space-y-3">
      <SectionLabel>Error</SectionLabel>
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
        <p className="whitespace-pre-wrap wrap-break-word text-sm text-destructive">
          {error}
        </p>
      </div>
    </section>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-sm font-medium tracking-[0.14em] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-1.5 flex items-start gap-2">
        <p className="min-w-0 break-all text-sm font-medium text-foreground">
          {value}
        </p>
      </div>
    </div>
  )
}

function ReferenceCard({
  label,
  url,
  type,
}: {
  label: string
  url: string
  type: "image" | "video"
}) {
  const previewUrl = buildOptimizeddImageUrl(
    url,
    imageUrlTransforms.previews.contentCard,
  )

  return (
    <figure className="space-y-2">
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="overflow-hidden rounded-2xl border bg-black/40">
        {type === "video" ? (
          <video
            src={url}
            controls
            playsInline
            className="aspect-4/3 w-full object-contain"
          />
        ) : (
          <img
            src={previewUrl}
            alt={label}
            className="aspect-4/3 w-full object-contain"
          />
        )}
      </div>
    </figure>
  )
}
