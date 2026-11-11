import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react"
import { CtaButton } from "../components/cta-button"
import { StackedCarousel } from "../components/stacked-carousel"

const ease = [0.22, 1, 0.36, 1] as const

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, ease }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const steps = [
  {
    title: "Think it through",
    description:
      "Brainstorm with a creative partner that does the research. Ask it to find a real story, then turn it into a plan.",
    label: "Research / Plan",
    images: [
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/plan_1.png",
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/plan_2.png",
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/plan_3.png",
    ],
  },
  {
    title: "Build your world once",
    description:
      "Define your film's concept, genre, and visual style, then add your characters, locations, and props. Generate a character sheet once, and your AI remembers all of it in every scene.",
    label: "The world / Cast",
    images: [
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/lock_1.png",
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/lock_2.png",
    ],
  },
  {
    title: "See the movie before you make it",
    description:
      "Turn your script into a storyboard and fix the story before you spend time and credits on video.",
    label: "Script / Storyboard",
    images: [
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/storyboard_1.png",
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/storyboard_2.png",
    ],
  },
  {
    title: "Generate once. Stay consistent.",
    description:
      "Ask for images, video, voice, or music in plain language. Your AI already knows your characters, style, and story, so shot 40 matches shot 1. Want more control? Open the media tab and tune every detail yourself.",
    label: "Scene 01 / Scene 40",
    images: [
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/media_generator.png",
    ],
  },
  {
    title: "Cut it your way",
    description:
      "An editor your AI can drive. Tell it what you want, then take the wheel whenever you like. Same timeline, shared control.",
    label: "Timeline / Final cut",
    images: [
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/timeline_1.png",
      "https://cdn.sohizi.com/cdn-cgi/image/format=avif/app/timeline_2.png",
    ],
  },
] as const

function ProblemSection() {
  return (
    <section
      className="bg-[#f0f0ea] px-4 py-24 text-[#111312] sm:px-6 sm:py-36"
      data-nav-contrast="light"
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal className="grid gap-10 pt-7 lg:grid-cols-[1.15fr_.85fr] lg:gap-20">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-black/50">
              01 / Why AI films fall apart
            </p>
            <h2 className="mt-12 max-w-[11ch] font-display text-[clamp(3.8rem,7.8vw,8rem)] font-medium leading-[0.92] tracking-[-0.08em]">
              Your film is one story.
              <br />
              <span className="text-black/35">
                Your tools are ten different apps.
              </span>
            </h2>
          </div>
          <div className="flex flex-col justify-end gap-6 pb-2 text-base leading-relaxed text-black/65 sm:text-xl">
            <p>
              Your script is in one app, your images in another, your voiceover
              in a third. None of them talk to each other, so you re-explain
              your story every time you switch windows, and you pay credits for
              the privilege.
            </p>
            <p>
              Even then, the results drift. Your hero's face changes. Her jacket
              changes color. Midday turns into sunset.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function MediaStage({
  step,
  active = true,
}: {
  step: (typeof steps)[number]
  active?: boolean
}) {
  return (
    <StackedCarousel
      images={step.images}
      label={step.label}
      active={active}
      className="w-full max-w-full"
    />
  )
}

function StepChapter({
  step,
  index,
  active,
  registerStep,
}: {
  step: (typeof steps)[number]
  index: number
  active: boolean
  registerStep: (index: number, element: HTMLDivElement | null) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  })
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.55, 0.82, 1],
    [0.9, 0.98, 1.04, 1.12, 1.18],
  )
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.3, 0.55, 0.82, 1],
    [0.45, 0.8, 1, 0.65, 0],
  )

  useEffect(() => {
    registerStep(index, ref.current)
    return () => registerStep(index, null)
  }, [index, registerStep])

  return (
    <div
      ref={ref}
      className="min-w-0 py-12 lg:flex lg:min-h-[74svh] lg:flex-col lg:justify-center lg:py-16"
    >
      <motion.div
        style={reduced ? undefined : { scale, opacity }}
        className="origin-left"
      >
        <span
          className={`font-display text-5xl leading-none tracking-tight transition-colors duration-500 sm:text-6xl ${active ? "text-white" : "text-[#8c9f8c]"}`}
        >
          0{index + 1}
        </span>
        <h3
          className={`mt-6 max-w-[15ch] font-display text-3xl leading-[1.05] tracking-tight transition-colors duration-500 sm:text-5xl ${active ? "text-white" : "text-white/50"}`}
        >
          {step.title}
        </h3>
        <p
          className={`mt-6 max-w-lg text-base leading-relaxed transition-colors duration-500 sm:text-xl ${active ? "text-white/80" : "text-white/45"}`}
        >
          {step.description}
        </p>
      </motion.div>
      <div className="mt-10 lg:hidden">
        <MediaStage step={step} active={active} />
      </div>
    </div>
  )
}

function StepsSection() {
  const [active, setActive] = useState(0)
  const reduced = useReducedMotion()
  const section = useRef<HTMLElement>(null)
  const stepRefs = useRef<Array<HTMLDivElement | null>>([])
  const registerStep = useCallback(
    (index: number, element: HTMLDivElement | null) => {
      stepRefs.current[index] = element
    },
    [],
  )
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start end", "end start"],
  })
  const titleY = useTransform(
    scrollYProgress,
    [0, 1],
    [reduced ? 0 : 60, reduced ? 0 : -60],
  )

  useEffect(() => {
    let frame = 0
    const updateActive = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const focusY =
          window.innerHeight * (window.innerWidth >= 1024 ? 0.5 : 0.42)
        let nearest = 0
        let distance = Infinity
        stepRefs.current.forEach((element, index) => {
          if (!element) return
          const rect = element.getBoundingClientRect()
          const currentDistance =
            rect.top <= focusY && rect.bottom >= focusY
              ? 0
              : Math.min(
                  Math.abs(rect.top - focusY),
                  Math.abs(rect.bottom - focusY),
                )
          if (currentDistance < distance) {
            nearest = index
            distance = currentDistance
          }
        })
        setActive(nearest)
      })
    }
    updateActive()
    window.addEventListener("scroll", updateActive, { passive: true })
    window.addEventListener("resize", updateActive)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", updateActive)
      window.removeEventListener("resize", updateActive)
    }
  }, [])

  return (
    <section
      ref={section}
      id="how-it-works"
      className="scroll-mt-20 overflow-clip bg-[#070909]/55 px-4 py-24 text-white sm:px-6 sm:py-36"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-start justify-between pt-6 text-xs uppercase tracking-[0.2em] text-white/50">
          <span>02 / How it works</span>
          <span>Five chapters · One film</span>
        </div>
        <motion.h2
          style={{ y: titleY }}
          className="relative z-10 my-16 max-w-[13ch] font-display text-[clamp(3.5rem,8vw,9rem)] font-medium leading-[0.92] tracking-[-0.075em] sm:my-24"
        >
          Creativity should flow,{" "}
          <span className="text-white/35">not feel like a workflow.</span>
        </motion.h2>
        <div className="grid items-start gap-8 lg:grid-cols-[.76fr_1.24fr] lg:gap-16">
          <div className="z-10 hidden min-w-0 lg:sticky lg:top-24 lg:order-2 lg:block">
            <div aria-live="polite" aria-atomic="true">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={active}
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: 0.35, ease }}
                >
                  <MediaStage step={steps[active]} active />
                </motion.div>
              </AnimatePresence>
            </div>
            <p className="mt-4 hidden text-xs uppercase tracking-[0.18em] text-white/35 lg:block">
              Scroll to follow the film
            </p>
          </div>
          <div className="min-w-0 lg:order-1">
            {steps.map((step, index) => (
              <StepChapter
                key={step.title}
                step={step}
                index={index}
                active={active === index}
                registerStep={registerStep}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function MissionSection() {
  return (
    <section
      className="relative overflow-hidden bg-[#e7e5dd] px-4 py-28 text-[#111312] sm:px-6 sm:py-44"
      data-nav-contrast="light"
    >
      <div className="mx-auto max-w-[1400px]">
        <div className="flex justify-between pt-6 text-xs uppercase tracking-[0.2em] text-black/45">
          <span>03 / The reason we build</span>
        </div>
        <Reveal className="mt-20 grid gap-14 lg:grid-cols-[1.4fr_.6fr] lg:gap-20">
          <h2 className="font-display text-[clamp(3.5rem,7.5vw,8rem)] font-medium leading-[0.93] tracking-[-0.075em]">
            Making a film should feel like{" "}
            <span className="text-black/35">directing.</span>
          </h2>
          <div className="flex flex-col justify-end">
            <p className="text-xl leading-relaxed text-black/65">
              We're building the studio we wished existed: one place where any
              filmmaker can take a story from first idea to finished film
              without losing the vision along the way.
            </p>
            <div className="mt-8">
              <CtaButton
                location="mission"
                className="rounded-full bg-[#111312] text-white hover:bg-black/80"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function StorySections() {
  return (
    <>
      <ProblemSection />
      <StepsSection />
      <MissionSection />
    </>
  )
}
