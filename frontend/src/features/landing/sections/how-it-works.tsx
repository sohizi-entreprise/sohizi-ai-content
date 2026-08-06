import { Spotlight } from '@/components/ui/spotlight'
import { howItWorks } from '../content'

export function HowItWorksSection() {
  return (
    <section
      id={howItWorks.id}
      className="relative overflow-hidden scroll-mt-20 border-t border-white/5 bg-muted/20 px-4 py-20 sm:px-6 sm:py-28"
    >
      <Spotlight
        className="-top-40 left-0 z-0 md:-top-20 md:left-60"
        fill="var(--primary)"
      />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div className="max-w-2xl space-y-6">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
            {howItWorks.headline}
          </h2>
          <p className="text-base leading-relaxed text-foreground/70 sm:text-lg">
            {howItWorks.body}
          </p>
        </div>

        <div className="mt-12 aspect-video w-full overflow-hidden rounded-2xl bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${howItWorks.youtubeId}`}
            title={howItWorks.youtubeTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="size-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </section>
  )
}
