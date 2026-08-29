import { useRef, useState } from 'react'
import { Play } from 'lucide-react'
import { showcase } from '../content'
import { cn } from '@/lib/utils'

export function ShowcaseSection() {
  return (
    <section
      id={showcase.id}
      className="scroll-mt-20 border-t border-white/5 bg-muted/20 px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {showcase.headline}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {showcase.body}
          </p>
        </div>

        <div className="mt-12 grid auto-rows-[14rem] grid-cols-1 gap-4 sm:auto-rows-[16rem] sm:grid-cols-2 lg:auto-rows-[11rem] lg:grid-flow-dense lg:grid-cols-3">
          {showcase.items.map((item) => (
            <ShowcaseTile key={item.id} item={item} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          {showcase.caption}
        </p>
      </div>
    </section>
  )
}

function ShowcaseTile({ item }: { item: (typeof showcase.items)[number] }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const handleEnter = () => {
    if (!item.videoUrl || !videoRef.current) return
    void videoRef.current
      .play()
      .then(() => setPlaying(true))
      .catch(() => {})
  }

  const handleLeave = () => {
    if (!videoRef.current) return
    videoRef.current.pause()
    videoRef.current.currentTime = 0
    setPlaying(false)
  }

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-white/10 bg-card',
        item.span,
      )}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {item.videoUrl ? (
        <video
          ref={videoRef}
          src={item.videoUrl}
          poster={item.poster}
          muted
          loop
          playsInline
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-300',
            playing ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      <img
        src={item.poster}
        alt=""
        className={cn(
          'absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-[1.03]',
          playing && 'opacity-0',
        )}
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <span className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
          <Play className="size-5 fill-white text-white" />
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          {item.label}
        </p>
        <h3 className="mt-1 font-display text-lg font-semibold text-white">
          {item.title}
        </h3>
      </div>
    </article>
  )
}
