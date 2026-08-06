import { GlowingEffect } from '@/components/ui/glowing-effect'
import { cn } from '@/lib/utils'

const GRID_AREAS = [
  'md:[grid-area:1/1/2/7] xl:[grid-area:1/1/2/5]',
  'md:[grid-area:1/7/2/13] xl:[grid-area:2/1/3/5]',
  'md:[grid-area:2/1/3/7] xl:[grid-area:1/5/3/8]',
  'md:[grid-area:2/7/3/13] xl:[grid-area:1/8/2/13]',
  'md:[grid-area:3/1/4/13] xl:[grid-area:2/8/3/13]',
] as const

type Props = {
  className?: string
  items: {
    icon: React.ReactNode
    title: string
    description: string
  }[]
}

export function SolutionsGrid({ className, items }: Props) {
  return (
    <ul
      className={cn(
        'grid grid-cols-1 grid-rows-none gap-4 md:grid-cols-12 md:grid-rows-3 lg:gap-4 xl:max-h-136 xl:grid-rows-2',
        className,
      )}
    >
      {items.map((item, index) => (
        <GridItem
          key={index}
          area={GRID_AREAS[index] ?? GRID_AREAS[GRID_AREAS.length - 1]}
          icon={item.icon}
          title={item.title}
          description={item.description}
        />
      ))}
    </ul>
  )
}

interface GridItemProps {
  area: string
  icon: React.ReactNode
  title: string
  description: React.ReactNode
}

const GridItem = ({ area, icon, title, description }: GridItemProps) => {
  return (
    <li className={cn('min-h-56 list-none', area)}>
      <div className="relative h-full rounded-2xl bg-card md:rounded-3xl">
        <GlowingEffect
          blur={0}
          borderWidth={3}
          spread={80}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
        />
        <div className="border-0.75 relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-2xl p-6 md:p-6">
          <div className="relative flex flex-1 flex-col justify-between gap-3">
            <div className="w-fit rounded-lg border border-gray-600 p-2">
              {icon}
            </div>
            <div className="space-y-3">
              <h3 className="-tracking-4 pt-0.5 font-sans text-xl/[1.375rem] font-semibold text-balance text-black md:text-2xl/[1.875rem] dark:text-foreground">
                {title}
              </h3>
              <h2 className="font-sans text-sm/[1.125rem] text-black md:text-base/[1.375rem] dark:text-neutral-400 [&_b]:md:font-semibold [&_strong]:md:font-semibold">
                {description}
              </h2>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}
