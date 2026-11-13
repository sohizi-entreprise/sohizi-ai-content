import { MarketingShell } from "../marketing-shell"
import type { LegalDocument } from "../content/legal"

export function LegalPage({ document }: { document: LegalDocument }) {
  const sectionLinks = document.sections.map((section, index) => (
    <li key={section.heading}>
      <a
        href={`#section-${index + 1}`}
        className="flex items-baseline gap-3 text-sm leading-snug text-white/45 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      >
        <span className="font-mono text-[11px] text-primary/70">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span>{section.heading}</span>
      </a>
    </li>
  ))

  return (
    <MarketingShell>
      <article className="bg-[#080909] text-white">
        <header className="relative overflow-hidden px-4 pb-16 pt-32 sm:px-6 sm:pb-24 sm:pt-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-32 top-12 size-[420px] rounded-full bg-primary/10 blur-[110px] sm:size-[600px]"
          />
          <div className="relative mx-auto max-w-[1400px]">
            <h1 className="max-w-[12ch] font-display text-[clamp(3.5rem,10vw,8rem)] font-medium leading-[0.9] tracking-[-0.08em]">
              {document.title}
            </h1>
            <div className="mt-12 flex flex-col gap-8 border-t border-white/15 pt-7 sm:mt-16 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-3xl text-base leading-relaxed text-white/65 sm:text-xl">
                {document.intro}
              </p>
              <p className="shrink-0 text-xs uppercase tracking-[0.16em] text-white/40 sm:pt-1">
                Updated {document.lastUpdated}
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto grid max-w-[1400px] gap-12 px-4 pb-24 sm:px-6 sm:pb-36 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.7fr)] lg:gap-20">
          <nav aria-label={`${document.title} sections`} className="lg:pt-3">
            <details className="group border-y border-white/15 lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-xs font-medium uppercase tracking-[0.2em] text-primary marker:hidden">
                Jump to a section
                <span
                  aria-hidden="true"
                  className="text-xl font-light leading-none text-white/50 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <ol className="grid gap-4 pb-6 sm:grid-cols-2">{sectionLinks}</ol>
            </details>
            <div className="hidden lg:sticky lg:top-28 lg:block">
              <p className="mb-5 text-xs font-medium uppercase tracking-[0.22em] text-primary">
                On this page
              </p>
              <ol className="grid gap-y-3">{sectionLinks}</ol>
            </div>
          </nav>

          <div>
            {document.sections.map((section, index) => (
              <section
                key={section.heading}
                id={`section-${index + 1}`}
                className="scroll-mt-28 border-t border-white/15 py-9 sm:py-12"
              >
                <div className="grid gap-5 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-8">
                  <span
                    aria-hidden="true"
                    className="font-mono text-xs tracking-wider text-primary"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-medium leading-tight tracking-[-0.04em] text-white sm:text-3xl">
                      {section.heading}
                    </h2>
                    <div className="mt-6 space-y-5">
                      {section.paragraphs.map((paragraph) => (
                        <p
                          key={paragraph.slice(0, 48)}
                          className="max-w-[68ch] text-[15px] leading-[1.8] text-white/65 sm:text-base"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
