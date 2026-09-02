import {
  AlertCircle,
  ArrowLeftRight,
  Brain,
  CheckCircle2,
  Layers,
  Sparkles,
  Wallet,
  Workflow,
} from "lucide-react"
import { compareRows, problem } from "../content"

const categoryIcons = [
  Layers,
  Workflow,
  Brain,
  Sparkles,
  Wallet,
  ArrowLeftRight,
]

export function ProblemCompareSection() {
  return (
    <section
      data-nav-contrast="light"
      className="bg-white-brand px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-background sm:text-4xl md:text-5xl">
            {problem.headline}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {problem.body}
          </p>
          <p className="mt-4 text-base font-medium text-muted-foreground sm:text-lg">
            {problem.punchline}
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10 bg-card sm:mt-16">
          <div className="hidden grid-cols-[minmax(8rem,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)] border-b border-white/8 md:grid">
            <div className="bg-muted/40 px-5 py-5" />
            <div className="px-5 py-5 text-muted-foreground">
              Tool-hopping workflow
            </div>
            <div className="flex items-center gap-2 px-5 py-5">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                S
              </span>
              <span className="font-medium text-foreground">Sohizi Lab</span>
            </div>
          </div>

          {compareRows.map((row, index) => {
            const Icon = categoryIcons[index] ?? Layers
            return (
              <div
                key={row.category}
                className="grid border-b border-white/8 last:border-b-0 md:grid-cols-[minmax(8rem,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)]"
              >
                <div className="flex items-center gap-2.5 bg-muted/30 px-4 py-4 sm:px-5 sm:py-5">
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {row.category}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 bg-white/2 px-4 py-3 sm:px-5 sm:py-5">
                  <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">
                    Tools
                  </span>
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-chart-4" />
                  <span className="text-sm text-foreground">
                    {row.traditional}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 px-4 py-3 sm:px-5 sm:py-5">
                  <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground md:hidden">
                    Sohizi
                  </span>
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    {row.sohizi}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
