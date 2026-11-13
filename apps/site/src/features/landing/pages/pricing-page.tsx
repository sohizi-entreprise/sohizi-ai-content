import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@sohizi/ui/accordion"
import { WavyBackground } from "@sohizi/ui/wavy-background"
import { MarketingShell } from "../marketing-shell"
import { CtaButton } from "../components/cta-button"
import {
  creditPacks,
  plans,
  pricingFaq,
  pricingPage,
  sharedPlanFeatures,
} from "../content/pricing"
import { cn } from "@/lib/utils"

/** Brand lemon green + nearby teal (hex for reliable canvas support) */
const PRICING_WAVE_COLORS = [
  "#8CFF4A",
  "#5FE07A",
  "#3DCFB0",
  "#B8FF6A",
  "#6AE0A0",
]

const ease = [0.22, 1, 0.36, 1] as const
const CREDIT_STEP = 50
const CREDIT_SLIDER_MAX = 50_000

type TopUpPrice = {
  id: string
  name: string
  unitAmount: number
  minimumUnits: number | null
  maximumUnits: number | null
  currency: string
}

function formatTopUpPrice(amountInCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: amountInCents % 100 === 0 ? 0 : 2,
  }).format(amountInCents / 100)
}

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function PricingPage() {
  const reduceMotion = useReducedMotion()
  const [topUpPrice, setTopUpPrice] = useState<TopUpPrice | null>(null)
  const [topUpUnits, setTopUpUnits] = useState(1000)

  useEffect(() => {
    let mounted = true
    fetch("/api/billing/top-up-pricing")
      .then((response) => {
        if (!response.ok) throw new Error("Top-up pricing unavailable")
        return response.json() as Promise<{ products: Array<TopUpPrice> }>
      })
      .then(({ products }) => {
        if (mounted) setTopUpPrice(products[0] ?? null)
      })
      .catch(() => {
        if (mounted) setTopUpPrice(null)
      })
    return () => {
      mounted = false
    }
  }, [])

  const minimumTopUp = topUpPrice
    ? Math.ceil((topUpPrice.minimumUnits ?? 1) / CREDIT_STEP) * CREDIT_STEP
    : CREDIT_STEP
  const maximumTopUp = topUpPrice
    ? Math.max(
        minimumTopUp,
        Math.min(
          CREDIT_SLIDER_MAX,
          topUpPrice.maximumUnits ?? CREDIT_SLIDER_MAX,
        ),
      )
    : CREDIT_SLIDER_MAX
  const selectedTopUp = Math.min(
    maximumTopUp,
    Math.max(minimumTopUp, topUpUnits),
  )

  return (
    <MarketingShell>
      <section className="relative overflow-hidden bg-[#080909] px-4 pb-12 pt-32 text-white sm:px-6 sm:pb-16 sm:pt-40">
        <div className="mx-auto max-w-[1400px]">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0.8, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease }}
            className="relative z-10"
          >
            <h1 className="max-w-[14ch] font-display text-[clamp(2.75rem,9vw,7.5rem)] font-medium leading-[0.9] tracking-[-0.08em]">
              {pricingPage.headline}
            </h1>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-white/65 sm:mt-10 sm:text-xl">
              {pricingPage.body}
            </p>
          </motion.div>
        </div>

        <WavyBackground
          containerClassName="mt-14 h-auto w-full items-stretch justify-start overflow-visible sm:mt-20"
          className="mx-auto w-full max-w-[1400px]"
          backgroundFill="#080909"
          colors={PRICING_WAVE_COLORS}
          speed="slow"
          blur={12}
          waveOpacity={0.45}
          waveWidth={40}
        >
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
            {plans.map((plan, index) => (
              <Reveal
                key={plan.id}
                delay={reduceMotion ? 0 : index * 0.06}
                className="h-full"
              >
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-[1.25rem] border border-white/12 bg-[#0c100f]/72 px-6 py-8 transition duration-300 sm:px-7 sm:py-9",
                    plan.highlighted
                      ? "border-primary/55 bg-[#121a14]/85 shadow-[0_28px_80px_rgba(0,0,0,.35)]"
                      : "hover:border-white/25",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-display text-xl font-medium tracking-tight text-white sm:text-2xl">
                      {plan.name}
                    </p>
                    {plan.badge ? (
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-black">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-8 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl font-medium tracking-[-0.06em] text-white">
                      ${plan.price}
                    </span>
                    <span className="text-sm text-white/45">/ month</span>
                  </p>

                  <p className="mt-2 text-sm font-medium text-primary">
                    {plan.credits.toLocaleString()} credits / month
                  </p>

                  <p className="mt-6 min-h-12 text-sm leading-relaxed text-white/65">
                    {plan.description}
                  </p>

                  <div className="mt-8">
                    <CtaButton
                      location={`pricing_${plan.id}`}
                      className="w-full"
                      size="sm"
                      label={plan.ctaLabel}
                    />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </WavyBackground>

        <Reveal className="mx-auto mt-10 max-w-[1400px] sm:mt-12">
          <div className="rounded-[1.25rem] border border-white/12 bg-[#0c100f]/72 px-6 py-10 backdrop-blur-md sm:px-10 sm:py-12">
            <h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
              Every plan includes the full studio
            </h2>
            <ul className="mt-8 grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {sharedPlanFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm leading-snug text-white/70"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal className="mx-auto mt-8 max-w-[1400px] sm:mt-10">
          <div className="rounded-[1.25rem] border border-white/12 bg-[#0c100f]/72 px-6 py-8 backdrop-blur-md sm:px-10 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {creditPacks.eyebrow}
            </p>
            <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
                  {creditPacks.headline}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">
                  {creditPacks.body}
                </p>
              </div>
              {topUpPrice ? (
                <div className="shrink-0 lg:text-right">
                  <p className="flex items-baseline gap-2 lg:justify-end">
                    <span className="font-display text-5xl font-medium tracking-[-0.06em] text-white">
                      {formatTopUpPrice(
                        selectedTopUp * topUpPrice.unitAmount,
                        topUpPrice.currency,
                      )}
                    </span>
                    <span className="text-sm text-white/55">one-time</span>
                  </p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {selectedTopUp.toLocaleString()} credits
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/55">
                  Current price appears here when top-ups are available.
                </p>
              )}
            </div>

            {topUpPrice ? (
              <div className="mt-8">
                <div className="mb-3 text-sm">
                  <label
                    htmlFor="top-up-credits"
                    className="font-medium text-white"
                  >
                    Choose credits
                  </label>
                </div>
                <input
                  id="top-up-credits"
                  type="range"
                  min={minimumTopUp}
                  max={maximumTopUp}
                  step={CREDIT_STEP}
                  value={selectedTopUp}
                  onChange={(event) =>
                    setTopUpUnits(Number(event.target.value))
                  }
                  className="w-full accent-primary"
                />
                <div className="mt-3 flex justify-between text-xs text-white/45">
                  <span>{minimumTopUp.toLocaleString()} credits</span>
                  <span>{maximumTopUp.toLocaleString()} credits</span>
                </div>
              </div>
            ) : null}
            <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-2xl text-sm leading-relaxed text-white/50">
                {creditPacks.note}
              </p>
              <CtaButton
                location="pricing_credit_packs"
                size="sm"
                label="Start with a plan"
                className="shrink-0"
              />
            </div>
          </div>
        </Reveal>
      </section>

      <section
        id="pricing-faq"
        className="scroll-mt-20 bg-[#080909] px-4 pb-28 pt-12 text-white sm:px-6 sm:pb-40 sm:pt-16"
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="mx-auto mb-14 max-w-4xl text-center sm:mb-20">
            <h2 className="font-display text-[clamp(3.2rem,8vw,7rem)] font-medium leading-[0.95] tracking-[-0.075em]">
              {pricingFaq.headline}
            </h2>
            <p className="mx-auto mt-7 max-w-lg text-base leading-relaxed text-white/50 sm:text-lg">
              {pricingFaq.body}
            </p>
            <p className="mx-auto mt-5 text-sm text-white/40">
              {pricingFaq.contactLine}{" "}
              <a
                href={`mailto:${pricingFaq.contactEmail}`}
                className="text-white/70 underline decoration-white/30 underline-offset-4 transition hover:decoration-white"
              >
                {pricingFaq.contactEmail}
              </a>
            </p>
          </div>

          <Accordion
            type="single"
            collapsible
            className="mx-auto max-w-4xl border-t border-white/20"
          >
            {pricingFaq.items.map((item) => (
              <AccordionItem
                key={item.question}
                value={item.question}
                className="border-white/20"
              >
                <AccordionTrigger className="group items-center rounded-none py-6 font-display text-lg font-medium tracking-tight text-white hover:no-underline sm:py-8 sm:text-2xl [&>svg]:hidden">
                  <span>{item.question}</span>
                  <span
                    aria-hidden
                    className="ml-auto text-2xl font-light leading-none text-white/65 transition-transform duration-300 group-data-[state=open]:rotate-45 sm:text-3xl"
                  >
                    +
                  </span>
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-7 pr-8 text-base leading-relaxed text-white/55 sm:pb-9 sm:text-lg">
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
