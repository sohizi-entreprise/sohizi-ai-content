import { Film, Megaphone, Building2 } from 'lucide-react'
import { CtaButton } from '../components/cta-button'
import { audience } from '../content'

const icons = [Film, Megaphone, Building2]

export function AudienceSection() {
  return (
    <section className="border-t border-white/5 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-2xl font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {audience.headline}
        </h2>

        <ul className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-3">
          {audience.segments.map((segment, index) => {
            const Icon = icons[index] ?? Film
            return (
              <li
                key={segment.title}
                className="rounded-2xl border border-white/10 bg-card/40 p-6"
              >
                <Icon className="size-6 text-primary" />
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {segment.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {segment.description}
                </p>
              </li>
            )
          })}
        </ul>

        <div className="mt-10">
          <CtaButton />
        </div>
      </div>
    </section>
  )
}
