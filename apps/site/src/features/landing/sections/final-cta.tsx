import { motion, useReducedMotion } from "motion/react"
import { CtaButton } from "../components/cta-button"
import { finalCta } from "../content"

export function FinalCtaSection() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="overflow-hidden bg-[#080909]/55 px-4 pb-20 text-white sm:px-6 sm:pb-28">
      <div className="mx-auto max-w-[1400px] pt-6">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">
          05 / Your next film
        </p>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative isolate mt-12 overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#1a211e] px-6 py-24 text-center sm:mt-16 sm:rounded-[2rem] sm:px-12 sm:py-36"
        >
          <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_18%_20%,#68736388,transparent_48%),radial-gradient(ellipse_at_88%_90%,#6b554d99,transparent_52%),linear-gradient(135deg,#242d29,#111817)]" />
          <div className="pointer-events-none absolute -left-[10%] -top-[40%] -z-10 size-[65%] animate-mesh-a rounded-full bg-[#aeb4a0]/20 blur-[100px] motion-reduce:animate-none" />
          <div className="pointer-events-none absolute -bottom-[60%] -right-[15%] -z-10 size-[75%] animate-mesh-b rounded-full bg-[#a68770]/20 blur-[110px] motion-reduce:animate-none" />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[2%] left-1/2 z-0 w-max -translate-x-1/2 select-none font-display text-[22vw] font-bold leading-none tracking-[-0.09em] text-white/25 blur-[1px] sm:-bottom-[0.12em] sm:-z-10 sm:text-[19vw] sm:text-white/15 sm:blur-[2px]"
          >
            Sohizi Lab
          </div>
          <div className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-black/10 backdrop-blur-[12px]" />
          <div className="relative z-10 mx-auto max-w-5xl">
            <h2 className="font-display text-[clamp(3.6rem,7.4vw,8rem)] font-medium leading-[0.95] tracking-[-0.075em]">
              {finalCta.headline}
            </h2>
            <p className="mx-auto mt-7 max-w-lg text-base leading-relaxed text-white/70 sm:text-xl">
              {finalCta.body}
            </p>
            <div className="mt-9 flex flex-col items-center gap-4">
              <CtaButton
                location="final_cta"
                className="rounded-full bg-white text-black hover:bg-white/85"
              />
              <span className="text-xs text-white/55">
                No credit card required.
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
