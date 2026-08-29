import {
  IconAdjustmentsBolt,
  IconCloud,
  IconCurrencyDollar,
  IconEaseInOut,
  IconHeart,
  IconHelp,
  IconRouteAltLeft,
  IconTerminal2,
} from '@tabler/icons-react'
import { features } from '../content'
import { cn } from '@/lib/utils'

const featureIcons = [
  IconTerminal2,
  IconEaseInOut,
  IconCurrencyDollar,
  IconCloud,
  IconRouteAltLeft,
  IconHelp,
  IconAdjustmentsBolt,
  IconHeart,
]

export function FeaturesSection() {
  return (
    <section
      data-nav-contrast="light"
      className="bg-white-brand px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          className={cn(
            'max-w-2xl font-display text-3xl  tracking-tight text-background sm:text-4xl md:text-5xl',
            '',
          )}
        >
          {features.headline} <br />
          {features.subheadline}
        </h2>

        <div className="relative z-10 mx-auto mt-12 grid grid-cols-1 py-10 md:grid-cols-2 lg:grid-cols-4">
          {features.items.map((feature, index) => {
            const Icon = featureIcons[index] ?? IconTerminal2
            return (
              <Feature
                key={feature.title}
                title={feature.title}
                description={feature.description}
                icon={<Icon />}
                index={index}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Feature({
  title,
  description,
  icon,
  index,
}: {
  title: string
  description: string
  icon: React.ReactNode
  index: number
}) {
  return (
    <div
      className={cn(
        'group/feature relative flex flex-col py-10 lg:border-r dark:border-foreground/60',
        (index === 0 || index === 4) && 'lg:border-l dark:border-foreground/60',
        index < 4 && 'lg:border-b dark:border-foreground/60',
      )}
    >
      {index < 4 && (
        <div className="pointer-events-none absolute inset-0 h-full w-full bg-linear-to-t from-primary/10 to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100" />
      )}
      {index >= 4 && (
        <div className="pointer-events-none absolute inset-0 h-full w-full bg-linear-to-b from-primary/10 to-transparent opacity-0 transition duration-200 group-hover/feature:opacity-100" />
      )}
      <div className="relative z-10 mb-4 px-10 text-muted-foreground transition-colors duration-200 group-hover/feature:text-primary">
        {icon}
      </div>
      <div className="relative z-10 mb-2 px-10 text-lg font-bold">
        <div className="absolute inset-y-0 left-0 h-6 w-1 origin-center rounded-tr-full rounded-br-full bg-border transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-primary" />
        <span className="inline-block text-background transition duration-200 group-hover/feature:translate-x-2">
          {title}
        </span>
      </div>
      <p className="relative z-10 max-w-xs px-10 text-sm text-background/70">
        {description}
      </p>
    </div>
  )
}
