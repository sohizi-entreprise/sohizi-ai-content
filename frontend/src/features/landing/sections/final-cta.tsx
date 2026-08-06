import { motion } from 'motion/react'
import { CtaButton } from '../components/cta-button'
import { finalCta } from '../content'

export function FinalCtaSection() {
  return (
    <section className="relative overflow-x-clip border-t border-white/5 px-4 pb-28 pt-20 sm:px-6 sm:pb-36 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.77_0.22_148/0.15),transparent_55%)]" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-6xl px-6 py-14 sm:px-12 sm:py-20"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-3xl">
          <div className="absolute -left-[20%] -top-[30%] size-[70%] animate-mesh-a rounded-full bg-[radial-gradient(circle_at_center,oklch(0.77_0.22_148/0.55),oklch(0.68_0.16_155/0.2)_45%,transparent_70%)] blur-2xl" />
          <div className="absolute -bottom-[25%] -right-[15%] size-[75%] animate-mesh-b rounded-full bg-[radial-gradient(circle_at_center,oklch(0.78_0.12_185/0.45),oklch(0.77_0.22_148/0.25)_40%,transparent_70%)] blur-2xl" />
        </div>

        {/* Watermark sits behind the glass — top frosted, bottom peeks out sharp */}
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-14 left-1/2 z-0 w-max -translate-x-1/2 select-none font-display text-[16vw] font-bold leading-none tracking-tighter text-foreground sm:-bottom-16 sm:text-[8rem]"
        >
          Sohizi lab
        </div>

        <div className="absolute inset-0 z-1 rounded-3xl border border-white/10  backdrop-blur-md" />

        <div className="relative z-2 mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-semibold text-foreground sm:text-4xl md:text-5xl">
            {finalCta.headline}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-foreground/70 sm:text-lg">
            {finalCta.body}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <CtaButton />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
