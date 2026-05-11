import type { GeneratedMediaItem } from '../types'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type MediaPreviewDialogProps = {
  item: GeneratedMediaItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaPreviewDialog({
  item,
  open,
  onOpenChange,
}: MediaPreviewDialogProps) {
  if (!item || item.type === 'audio') {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-zinc-950/95 p-0 text-white sm:max-w-5xl">
        <DialogHeader className="border-b border-white/10 p-5">
          <DialogTitle>{item.title}</DialogTitle>
        </DialogHeader>

        <div className="p-5">
          {item.type === 'image' ? (
            <Carousel className="mx-auto max-w-4xl">
              <CarouselContent>
                {(item.variants ?? []).map((variant) => (
                  <CarouselItem key={variant.id}>
                    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                      <img
                        src={variant.url}
                        alt={item.title}
                        className="aspect-video h-full max-h-[68vh] w-full object-contain"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {(item.variants?.length ?? 0) > 1 ? (
                <>
                  <CarouselPrevious className="left-3 border-white/10 bg-black/60 text-white hover:bg-black/80" />
                  <CarouselNext className="right-3 border-white/10 bg-black/60 text-white hover:bg-black/80" />
                </>
              ) : null}
            </Carousel>
          ) : (
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black">
              <video
                src={item.url}
                poster={item.thumbnailUrl}
                controls
                autoPlay
                className="aspect-video max-h-[68vh] w-full object-contain"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
