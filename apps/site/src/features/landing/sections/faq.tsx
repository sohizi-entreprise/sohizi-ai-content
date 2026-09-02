import { CtaButton } from "../components/cta-button"
import { faq } from "../content"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@sohizi/ui/accordion"

export function FaqSection() {
  return (
    <section
      id={faq.id}
      data-nav-contrast="light"
      className="scroll-mt-20 bg-white-brand px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <h2 className="font-display text-3xl tracking-tight text-background sm:text-4xl">
            {faq.headline}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            {faq.contactLine}{" "}
            <a
              href={`mailto:${faq.contactEmail}`}
              className="underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {faq.contactEmail}
            </a>
          </p>

          <div className="mt-8 rounded-2xl border border-white/10 bg-card p-6">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {faq.ctaCard.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {faq.ctaCard.body}
            </p>
            <div className="mt-5">
              <CtaButton
                size="default"
                className="h-10 text-sm"
              />
            </div>
          </div>
        </div>

        <Accordion
          type="single"
          collapsible
          className="w-full"
        >
          {faq.items.map((item) => (
            <AccordionItem
              key={item.question}
              value={item.question}
              className="border-foreground/60"
            >
              <AccordionTrigger className="py-5 text-left text-base font-medium text-background hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-5 text-sm leading-relaxed text-background/70 sm:text-base">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
