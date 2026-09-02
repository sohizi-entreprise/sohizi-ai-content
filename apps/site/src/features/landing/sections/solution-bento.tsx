import { CreditCard, Fingerprint, Flame, GraduationCap } from "lucide-react"
import { CtaButton } from "../components/cta-button"
import { SolutionsGrid } from "../components/solutions-grid"
import { capabilityHub, solution } from "../content"
import { ContainerTextFlip } from "@sohizi/ui/container-text-flip"
import { CapabilityHub } from "@sohizi/ui/capability-hub"

const icons = [CreditCard, GraduationCap, Fingerprint, Flame]

const words = [...solution.words]
const capabilities = capabilityHub.capabilities.map((cap) => ({ ...cap }))

export function SolutionBentoSection() {
  return (
    <section className="border-t border-white/5 px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <h2 className="relative font-display text-3xl font-semibold leading-none tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {solution.headline}{" "}
            <ContainerTextFlip
              words={words}
              className="border border-foreground/20 text-3xl! sm:text-4xl! md:text-5xl!"
              textClassName="text-inherit leading-none text-primary"
            />
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {solution.paragraphs.map((p) => (
              <p key={p.slice(0, 32)}>{p}</p>
            ))}
          </div>
        </div>

        <CapabilityHub
          className="mt-12 sm:mt-16"
          hubLabel={capabilityHub.hubLabel}
          capabilities={capabilities}
        />

        <SolutionsGrid
          className="mt-12"
          items={solution.benefits.map((benefit, index) => {
            const Icon = icons[index] ?? CreditCard
            return {
              icon: (
                <Icon className="h-4 w-4 text-black dark:text-neutral-400" />
              ),
              title: benefit.title,
              description: benefit.description,
            }
          })}
        />

        <div className="mt-10">
          <CtaButton />
        </div>
      </div>
    </section>
  )
}
