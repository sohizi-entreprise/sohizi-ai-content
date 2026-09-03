import { useId } from "react"
import { motion } from "motion/react"
import { SparklesCore } from "@sohizi/ui/sparkles"
import { CtaButton } from "../components/cta-button"
import { hero } from "../content"
import { cn } from "@/lib/utils"

export function HeroSection() {
  return (
    <section className="relative min-h-svh overflow-hidden">
      <div className="pointer-events-none absolute w-full h-1/2 inset-x-0 top-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.04)_1px,transparent_1px)] bg-size-[48px_48px] mask-[radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-0 h-[300px] w-[600px] bg-[radial-gradient(ellipse_at_top,oklch(0.936036_0.225167_121.2409/0.18),transparent_60%)]" />

      <div className="absolute inset-x-0 top-0 h-1/2">
        <SparklesCore
          id="tsparticlesfullpage"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={10}
          className="w-full h-full"
          particleColor="#FFFFFF"
        />
      </div>

      <div className="relative mx-auto flex min-h-svh max-w-7xl flex-col justify-center px-4 pb-16 pt-24 sm:px-6 sm:pb-26">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.7fr)] md:items-center md:gap-12 lg:gap-20"
        >
          <div className="min-w-0">
            <p className="inline-flex max-w-full items-center gap-2 rounded-full  bg-white/5 backdrop-blur-sm p-1 text-xs text-muted-foreground sm:text-sm">
              <span className="truncate font-medium text-foreground bg-background px-4 py-1 rounded-full">
                {hero.brand}
              </span>
              <span className="truncate pr-3 text-foreground">
                {hero.eyebrow}
              </span>
            </p>
            <h1 className="mt-5 max-w-[14ch] font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:mt-6 sm:text-5xl md:max-w-none md:text-6xl lg:text-7xl">
              {hero.headline}
            </h1>
          </div>

          <div className="flex min-w-0 flex-col items-start gap-5 md:max-w-xs lg:max-w-sm">
            <p className="text-base leading-relaxed text-foreground/75 sm:text-lg">
              {hero.subheadline}
            </p>
            <CtaButton />
          </div>
        </motion.div>

        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-30 left-1/2 z-1 hidden w-[140%] max-w-none -translate-x-1/2 translate-y-[58%] md:block"
        >
          <ArcBackground className="w-full" />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-10 left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap bg-linear-to-b from-muted-foreground/12 via-muted-foreground/6 via-45% to-muted-foreground/0 bg-clip-text text-center font-display text-[18vw] font-bold leading-none tracking-tighter text-transparent sm:text-[16vw]"
        >
          Sohizi lab
        </div>
      </div>
    </section>
  )
}

type ArcBackgroundProps = {
  className?: string
}

function ArcBackground({ className }: ArcBackgroundProps) {
  const id = useId().replace(/:/g, "")

  return (
    <svg
      viewBox="0 0 1951 1806"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn(
        "pointer-events-none h-auto w-full overflow-visible opacity-100 [--arc-glow:oklch(0.95_0.05_148)] [--arc-gold:oklch(0.68_0.16_155)] [--arc-warm:var(--primary)]",
        className,
      )}
    >
      <path
        d="M975.5 255C1402.88 255 1749 569.029 1749 956C1749 1342.97 1402.88 1657 975.5 1657C548.119 1657 202 1342.97 202 956C202 569.029 548.119 255 975.5 255Z"
        stroke={`url(#${id}-0)`}
        strokeWidth="4"
      />
      <path
        opacity="0.4"
        d="M975.5 253.5C1403.57 253.5 1750.5 568.065 1750.5 956C1750.5 1343.93 1403.57 1658.5 975.5 1658.5C547.432 1658.5 200.5 1343.93 200.5 956C200.5 568.065 547.432 253.5 975.5 253.5Z"
        stroke={`url(#${id}-1)`}
      />
      <g className="mix-blend-plus-lighter blur-md">
        <path
          d="M975.5 255C1402.88 255 1749 569.029 1749 956C1749 1342.97 1402.88 1657 975.5 1657C548.119 1657 202 1342.97 202 956C202 569.029 548.119 255 975.5 255Z"
          stroke={`url(#${id}-2)`}
          strokeWidth="4"
        />
      </g>
      <g opacity="0.4" className="mix-blend-plus-lighter blur-[30px]">
        <path
          d="M975.5 255C1398.3 255 1739 565.452 1739 946C1739 1326.55 1398.3 1637 975.5 1637C552.695 1637 212 1326.55 212 946C212 565.452 552.695 255 975.5 255Z"
          stroke={`url(#${id}-3)`}
          strokeWidth="24"
        />
      </g>
      <g opacity="0.4" className="mix-blend-plus-lighter blur-[30px]">
        <path
          d="M975.5 255C1398.3 255 1739 565.452 1739 946C1739 1326.55 1398.3 1637 975.5 1637C552.695 1637 212 1326.55 212 946C212 565.452 552.695 255 975.5 255Z"
          stroke={`url(#${id}-4)`}
          strokeWidth="24"
        />
      </g>
      <g opacity="0.4" className="mix-blend-plus-lighter blur-2xl">
        <path
          d="M975.5 255C1398.3 255 1739 565.452 1739 946C1739 1326.55 1398.3 1637 975.5 1637C552.695 1637 212 1326.55 212 946C212 565.452 552.695 255 975.5 255Z"
          stroke={`url(#${id}-5)`}
          strokeWidth="24"
        />
      </g>
      <g opacity="0.4" className="mix-blend-plus-lighter blur-[50px]">
        <path
          d="M975.5 255C1398.3 255 1739 565.452 1739 946C1739 1326.55 1398.3 1637 975.5 1637C552.695 1637 212 1326.55 212 946C212 565.452 552.695 255 975.5 255Z"
          stroke={`url(#${id}-6)`}
          strokeWidth="24"
        />
      </g>
      <g opacity="0.4" className="mix-blend-plus-lighter blur-[50px]">
        <path
          d="M975.5 212C1398.3 212 1739 522.452 1739 903C1739 1283.55 1398.3 1594 975.5 1594C552.695 1594 212 1283.55 212 903C212 522.452 552.695 212 975.5 212Z"
          stroke={`url(#${id}-7)`}
          strokeWidth="24"
        />
      </g>
      <g opacity="0.4" className="mix-blend-plus-lighter blur-[100px]">
        <path
          d="M975.5 212C1398.3 212 1739 522.452 1739 903C1739 1283.55 1398.3 1594 975.5 1594C552.695 1594 212 1283.55 212 903C212 522.452 552.695 212 975.5 212Z"
          stroke={`url(#${id}-8)`}
          strokeWidth="24"
        />
      </g>
      <defs>
        <linearGradient
          id={`${id}-0`}
          x1="976"
          y1="108.5"
          x2="976"
          y2="313.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-warm)" />
          <stop offset="1" stopColor="var(--arc-warm)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-1`}
          x1="976"
          y1="108.5"
          x2="976"
          y2="582"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-warm)" />
          <stop offset="1" stopColor="var(--arc-warm)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-2`}
          x1="975.5"
          y1="253"
          x2="976"
          y2="392"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-warm)" />
          <stop offset="1" stopColor="var(--arc-warm)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-3`}
          x1="975.5"
          y1="243"
          x2="976"
          y2="468.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-warm)" />
          <stop offset="1" stopColor="var(--arc-warm)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-4`}
          x1="975.5"
          y1="243"
          x2="976"
          y2="328.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-warm)" />
          <stop offset="1" stopColor="var(--arc-warm)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-5`}
          x1="975.5"
          y1="243"
          x2="976"
          y2="334"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-gold)" />
          <stop offset="1" stopColor="var(--arc-gold)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-6`}
          x1="975.5"
          y1="243"
          x2="976"
          y2="361"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-gold)" />
          <stop offset="1" stopColor="var(--arc-gold)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-7`}
          x1="975.5"
          y1="200"
          x2="976"
          y2="336.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-gold)" />
          <stop offset="1" stopColor="var(--arc-gold)" stopOpacity="0" />
        </linearGradient>
        <linearGradient
          id={`${id}-8`}
          x1="975.5"
          y1="200"
          x2="976"
          y2="780.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--arc-glow)" />
          <stop offset="1" stopColor="var(--arc-glow)" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}
