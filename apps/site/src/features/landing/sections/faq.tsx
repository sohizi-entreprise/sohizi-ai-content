import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@sohizi/ui/accordion"
import { faq } from "../content"

export function FaqSection() {
  return (
    <section
      id={faq.id}
      className="scroll-mt-20 bg-[#080909]/55 px-4 pb-28 pt-28 text-white sm:px-6 sm:pb-40 sm:pt-40"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="flex justify-between pt-6 text-xs uppercase tracking-[0.2em] text-white/45">
          <span>04 / Questions</span>
        </div>
        <div className="mx-auto mb-16 mt-20 max-w-4xl text-center sm:mb-24 sm:mt-28">
          <h2 className="font-display text-[clamp(3.7rem,8vw,8rem)] font-medium leading-[0.95] tracking-[-0.075em]">
            {faq.headline}
          </h2>
          <p className="mx-auto mt-7 max-w-lg text-base leading-relaxed text-white/50 sm:text-lg">
            Everything you need to know before your first frame.
          </p>
        </div>
        <Accordion
          type="single"
          collapsible
          className="mx-auto max-w-4xl border-t border-white/20"
        >
          {faq.items.map((item) => (
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
                {item.question === "How much does it cost?" && (
                  <>
                    {" "}
                    <a
                      href="/pricing"
                      className="text-white underline decoration-white/40 underline-offset-4 transition hover:decoration-white"
                    >
                      Pricing
                    </a>
                  </>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
