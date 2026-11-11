import { useEffect, useEffectEvent, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const ease = [0.22, 1, 0.36, 1] as const
const AUTO_MS = 3400

type StackedCarouselProps = {
  images: ReadonlyArray<string>
  label: string
  active?: boolean
  className?: string
}

export function StackedCarousel({
  images,
  label,
  active = true,
  className,
}: StackedCarouselProps) {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const count = images.length
  const canCycle = count > 1
  const peekCount = canCycle ? Math.min(2, count - 1) : 0

  const frontSrc = images[index] ?? images[0]
  const peeks = Array.from({ length: peekCount }, (_, depth) => {
    const imageIndex = (index + depth + 1) % count
    return {
      src: images[imageIndex],
      depth: depth + 1,
    }
  })

  const goNext = useEffectEvent(() => {
    setIndex((current) => (current + 1) % count)
  })

  useEffect(() => {
    if (!active || !canCycle || reduced) return
    const timer = window.setInterval(() => goNext(), AUTO_MS)
    return () => window.clearInterval(timer)
  }, [active, canCycle, reduced, count])

  useEffect(() => {
    if (active) return
    setIndex(0)
  }, [active])

  return (
    <div
      className={cn("relative w-full max-w-full", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="relative aspect-[1.76] w-full">
        <div
          className={cn(
            "absolute inset-y-0 left-0",
            canCycle ? "right-[11%] sm:right-[13%]" : "right-0",
          )}
        >
          {peeks
            .slice()
            .reverse()
            .map(({ src, depth }) => (
              <motion.div
                key={`peek-${depth}`}
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0c100f] shadow-[0_28px_80px_rgba(0,0,0,.35)]"
                animate={
                  reduced
                    ? undefined
                    : {
                        x: `${depth * 7}%`,
                        scale: 1 - depth * 0.04,
                        opacity: 1 - depth * 0.22,
                      }
                }
                transition={{ duration: 0.55, ease }}
                style={{ zIndex: depth }}
              >
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-contain"
                />
                <div className="absolute inset-0 bg-black/30" />
              </motion.div>
            ))}

          <AnimatePresence initial={false} mode="popLayout">
            <motion.button
              key={index}
              type="button"
              disabled={!canCycle}
              onClick={() => {
                if (!canCycle) return
                goNext()
              }}
              initial={reduced ? false : { opacity: 0, x: "14%", scale: 0.97 }}
              animate={{ opacity: 1, x: "0%", scale: 1 }}
              exit={
                reduced
                  ? undefined
                  : {
                      opacity: 0,
                      x: "-18%",
                      scale: 0.96,
                      transition: { duration: 0.45, ease },
                    }
              }
              transition={{ duration: 0.5, ease }}
              className={cn(
                "absolute inset-0 z-20 overflow-hidden rounded-[1.25rem] border border-white/12 bg-[#0c100f] shadow-[0_28px_80px_rgba(0,0,0,.45)] outline-none",
                canCycle && "cursor-pointer",
                "focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070909]",
              )}
              aria-label={
                canCycle ? `Show next image (${index + 1} of ${count})` : label
              }
            >
              <img
                src={frontSrc}
                alt=""
                draggable={false}
                loading="eager"
                decoding="async"
                className="size-full object-contain"
              />
            </motion.button>
          </AnimatePresence>
        </div>
      </div>

      {canCycle && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {images.map((src, imageIndex) => {
            const selected = imageIndex === index
            return (
              <button
                key={src}
                type="button"
                aria-label={`Show image ${imageIndex + 1}`}
                aria-current={selected}
                onClick={() => setIndex(imageIndex)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  selected
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/30 hover:bg-white/55",
                )}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
