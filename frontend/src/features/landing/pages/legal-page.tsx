import { MarketingShell } from '../marketing-shell'
import type { LegalDocument } from '../content/legal'

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <MarketingShell mainClassName="pt-14 sm:pt-16">
      <article className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            {document.title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {document.lastUpdated}
          </p>
          <p className="mt-8 text-base leading-relaxed text-muted-foreground">
            {document.intro}
          </p>

          <div className="mt-12 space-y-10">
            {document.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph.slice(0, 48)}
                      className="text-base leading-relaxed text-muted-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </MarketingShell>
  )
}
