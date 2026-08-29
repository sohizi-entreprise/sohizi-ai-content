import { Check, Minus } from 'lucide-react'
import { MarketingShell } from '../marketing-shell'
import { CtaButton } from '../components/cta-button'
import {
  comparisonRows,
  plans,
  pricingFaq,
  pricingPage,
} from '../content/pricing'
import type { CompareCell } from '../content/pricing'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { WavyBackground } from '@/components/ui/wavy-background'
import { cn } from '@/lib/utils'

/** Brand lemon green + nearby teal (hex for reliable canvas support) */
const PRICING_WAVE_COLORS = [
  '#8CFF4A',
  '#5FE07A',
  '#3DCFB0',
  '#B8FF6A',
  '#6AE0A0',
]

function CellValue({ value }: { value: CompareCell }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="mx-auto size-4 text-primary" aria-label="Included" />
    ) : (
      <Minus
        className="mx-auto size-4 text-muted-foreground/50"
        aria-label="Not included"
      />
    )
  }
  return <span className="text-sm text-foreground/90">{value}</span>
}

export function PricingPage() {
  return (
    <MarketingShell mainClassName="pt-14 sm:pt-16">
      <section className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {pricingPage.headline}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              {pricingPage.body}
            </p>
          </div>
        </div>

        {/* Full-bleed waves; cards stay in the centered content column */}
        <WavyBackground
          containerClassName="mt-20 h-auto w-full items-stretch justify-start overflow-visible"
          className="mx-auto w-full max-w-6xl px-4 sm:px-6"
          backgroundFill="transparent"
          colors={PRICING_WAVE_COLORS}
          speed="slow"
          blur={12}
          waveOpacity={0.45}
          waveWidth={40}
        >
          <div className="grid items-center gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  'relative flex flex-col rounded-2xl border backdrop-blur-sm transition-transform duration-300 ease-out will-change-transform hover:z-20',
                  plan.highlighted
                    ? 'z-10 border-primary/50 bg-background/80 px-7 py-10 shadow-primary hover:scale-[1.03] xl:scale-110 xl:hover:scale-[1.14]'
                    : 'border-white/10 bg-background px-5 py-7 hover:scale-[1.03]',
                  plan.id === 'free' &&
                    'xl:scale-[0.88] xl:opacity-75 xl:hover:scale-[0.93]',
                  plan.id === 'creator' &&
                    'xl:scale-[0.94] xl:opacity-90 xl:hover:scale-[0.99]',
                  plan.id === 'pro' &&
                    'xl:scale-[0.94] xl:opacity-90 xl:hover:scale-[0.99]',
                )}
              >
                {plan.highlighted ? (
                  <span className="absolute top-3 right-3 rounded-md bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                    Recommended
                  </span>
                ) : null}
                <p
                  className={cn(
                    'font-display font-semibold text-foreground',
                    plan.highlighted ? 'pr-24 text-xl' : 'text-base',
                  )}
                >
                  {plan.name}
                </p>
                <p className="mt-4 flex items-baseline gap-1">
                  {plan.price === 0 ? (
                    <span className="font-display text-3xl font-semibold tracking-tight text-foreground">
                      $0
                    </span>
                  ) : (
                    <>
                      <span
                        className={cn(
                          'font-display font-semibold tracking-tight text-foreground',
                          plan.highlighted ? 'text-5xl' : 'text-3xl',
                        )}
                      >
                        ${plan.price}
                      </span>
                      <span className="text-sm text-foreground">/month</span>
                    </>
                  )}
                </p>
                <p
                  className={cn(
                    'mt-2 font-medium text-primary',
                    plan.highlighted ? 'text-sm' : 'text-xs',
                  )}
                >
                  {plan.credits.toLocaleString()} credits
                  {plan.creditCadence === 'one-time'
                    ? ' (one-time)'
                    : ' / month'}
                </p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-foreground/80">
                  {plan.description}
                </p>
                <div className="mt-8">
                  <CtaButton
                    className={cn('w-full', !plan.highlighted && 'opacity-90')}
                    size="sm"
                    label={plan.ctaLabel}
                  />
                </div>
              </div>
            ))}
          </div>
        </WavyBackground>

        <div className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Compare plans
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Everything you need to write, generate, storyboard, and edit —
            scaled by how many credits you need.
          </p>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-200 border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10 bg-muted/30">
                  <th className="px-4 py-3 text-sm font-medium text-muted-foreground sm:px-6">
                    Feature
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className={cn(
                        'px-4 py-3 text-center text-sm font-semibold sm:px-6',
                        plan.highlighted ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.feature}
                    className="border-b border-white/5 last:border-0"
                  >
                    <td className="px-4 py-3.5 text-sm text-foreground/90 sm:px-6">
                      {row.feature}
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      <CellValue value={row.free} />
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      <CellValue value={row.creator} />
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      <CellValue value={row.studio} />
                    </td>
                    <td className="px-4 py-3.5 text-center sm:px-6">
                      <CellValue value={row.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section
        id="pricing-faq"
        data-nav-contrast="light"
        className="scroll-mt-20 bg-white-brand px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-background sm:text-4xl">
              {pricingFaq.headline}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {pricingFaq.body}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              {pricingFaq.contactLine}{' '}
              <a
                href={`mailto:${pricingFaq.contactEmail}`}
                className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-primary"
              >
                {pricingFaq.contactEmail}
              </a>
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {pricingFaq.items.map((item) => (
              <AccordionItem
                key={item.question}
                value={item.question}
                className="border-white/10"
              >
                <AccordionTrigger className="py-5 text-left text-base font-medium text-background hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </MarketingShell>
  )
}
