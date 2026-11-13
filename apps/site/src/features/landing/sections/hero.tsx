import { motion, useReducedMotion, useScroll, useTransform } from "motion/react"
import { useRef } from "react"
import { CtaButton } from "../components/cta-button"
import { DemoVideo } from "../components/demo-video"
import { hero } from "../content"

const ease = [0.22, 1, 0.36, 1] as const

const modelLogos: Array<{ name: string }> = [
  { name: "Google" },
  { name: "OpenAI" },
  { name: "Anthropic" },
  { name: "xAI" },
  { name: "Seedance" },
  { name: "ByteDance" },
  { name: "Kling AI" },
  { name: "ElevenLabs" },
  { name: "MiniMax" },
  // { name: "Microsoft" },
  // { name: "Mureka" },
  // { name: "Sonilo" },
  // { name: "Sync" },
  // { name: "Clarity AI" },
  // { name: "WaveSpeed AI" },
]

function ModelLogoRow() {
  return (
    <div className="relative z-20 mx-auto mt-12 max-w-[1240px] sm:mt-16">
      <p className="mb-7 text-center text-[10px] font-medium uppercase tracking-[0.24em] text-white/40">
        Leading AI providers, one creative space
      </p>
      <div
        className="model-logo-marquee overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
        aria-label={`AI providers and platforms: ${modelLogos.map(({ name }) => name).join(", ")}`}
      >
        <div className="model-logo-marquee-track flex w-max items-center">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="flex shrink-0 items-center gap-12 pr-12 sm:gap-20 sm:pr-20"
            >
              {modelLogos.map(({ name }) => (
                <span
                  key={name}
                  className="flex shrink-0 items-center gap-2.5 whitespace-nowrap font-display text-xl font-medium tracking-[-0.045em] text-white/65 sm:text-2xl"
                >
                  {/* {Icon && <Icon size={23} stroke={1.7} aria-hidden="true" />} */}
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function HeroSection() {
  const section = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end start"],
  })
  const stageY = useTransform(
    scrollYProgress,
    [0, 1],
    [0, reduceMotion ? 0 : -90],
  )

  return (
    <section
      ref={section}
      className="relative overflow-hidden bg-[#050505]/50 px-4 pb-20 pt-32 text-white sm:px-6 sm:pb-28 sm:pt-40"
    >
      <div className="mx-auto max-w-[1500px]">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0.8, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="relative z-10 text-center"
        >
          <p className="mb-7 text-xs font-medium uppercase tracking-[0.25em] text-white/50">
            Sohizi lab <span className="mx-3 text-primary">✳</span>{" "}
            {hero.eyebrow}
          </p>
          <h1 className="mx-auto max-w-[13ch] font-display text-[clamp(2.25rem,9vw,4rem)] font-medium leading-[0.86] tracking-[-0.085em] sm:text-[clamp(3.25rem,10vw,12rem)]">
            Stop prompting.
            <br />
            <span className="text-white/90">Start directing.</span>
          </h1>
        </motion.div>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0.8, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease }}
          className="relative z-10 mx-auto mt-8 max-w-3xl text-center sm:mt-10"
        >
          <p className="text-base leading-relaxed text-white/70 sm:text-xl">
            {hero.subheadline}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
            <CtaButton location="hero" />
            <a
              href="#product-demo"
              className="border-b border-white/50 pb-1 text-sm font-medium text-white transition hover:border-white"
            >
              Watch it in action ↗
            </a>
          </div>
          <p className="mt-4 text-xs text-white/40">No credit card required.</p>
        </motion.div>
        <motion.div
          style={{ y: stageY }}
          id="product-demo"
          className="relative z-20 mx-auto mt-16 max-w-[1240px] scroll-mt-24 sm:mt-20"
        >
          <DemoVideo
            src={hero.demoVideo}
            hdSrc={hero.demoVideoHd}
            poster={hero.demoPoster}
            label={hero.demoLabel}
            playback="manual"
            location="hero"
            priority
            fit="contain"
            className="aspect-video w-full border border-white/15 shadow-[0_45px_140px_rgba(0,0,0,.55)]"
          />
        </motion.div>
        <ModelLogoRow />
      </div>
    </section>
  )
}
