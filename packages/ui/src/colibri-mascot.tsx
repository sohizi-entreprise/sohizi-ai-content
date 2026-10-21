"use client"

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"
import { useEffect, useId } from "react"
import type { MotionValue } from "motion/react"
import type { SVGProps } from "react"

export type ColibriMascotState =
  "idle" | "loading" | "thinking" | "tool-calling" | "processing" | "responding"

export type ColibriMascotProps = SVGProps<SVGSVGElement> & {
  /** The expression and movement shown by the mascot. */
  state?: ColibriMascotState
  /** Width and height, unless either is set explicitly. */
  size?: number | string
  /** Main head color. */
  color?: string
  /** Eye and beak color. */
  featureColor?: string
  /** Color of the shooting star's tail shown while loading. */
  trailColor?: string
  /** Hides the mascot from assistive technology when it is purely decorative. */
  decorative?: boolean
}

type Keyframes = Array<number>

type Loop = {
  duration: number
  times?: Array<number>
  delay?: number
  ease: "easeInOut"
  repeat: number
}

type StateMotion = {
  body: {
    x: Keyframes
    y: Keyframes
    rotate: Keyframes
    scaleY: Keyframes
    loops: { x: Loop; y: Loop; rotate: Loop; scaleY: Loop }
  }
  face: { x: Keyframes; y: Keyframes; loop: Loop }
  crest: { rotate: Keyframes; loop: Loop }
  beak: { rotate: Keyframes; loop: Loop }
  squint: number
}

type StaticPose = {
  body: { x: number; y: number; rotate: number; scaleY: number }
  face: { x: number; y: number }
  beak: number
  squint: number
}

const loop = (duration: number, times?: Array<number>, delay = 0): Loop => ({
  duration,
  times,
  delay,
  ease: "easeInOut",
  repeat: Infinity,
})

const scale = (frames: Keyframes, factor: number) =>
  frames.map((value) => value * factor)

const STATE_MOTION: Record<ColibriMascotState, StateMotion> = {
  idle: {
    body: {
      x: [0],
      y: [0, -10, 0],
      rotate: [0, -1, 0],
      scaleY: [1, 1.012, 1],
      loops: {
        x: loop(1),
        y: loop(3.6),
        rotate: loop(3.6),
        scaleY: loop(3.6),
      },
    },
    face: {
      x: [0, 0, -9, -9, 0, 0, 7, 7, 0],
      y: [0, 0, 2, 2, 0, 0, -3, -3, 0],
      loop: loop(9, [0, 0.28, 0.33, 0.48, 0.53, 0.7, 0.75, 0.9, 1]),
    },
    crest: { rotate: [0, -3, 1.5, 0], loop: loop(3.6, [0, 0.4, 0.75, 1]) },
    beak: { rotate: [0], loop: loop(1) },
    squint: 1,
  },
  loading: {
    body: {
      x: [0],
      y: [0, -6, 0],
      rotate: [0],
      scaleY: [1, 1.008, 1],
      loops: {
        x: loop(1),
        y: loop(2.3),
        rotate: loop(1),
        scaleY: loop(2.3),
      },
    },
    face: { x: [0], y: [0], loop: loop(1) },
    crest: { rotate: [0, -3, 1.5, 0], loop: loop(2.3, [0, 0.4, 0.75, 1]) },
    beak: { rotate: [0], loop: loop(1) },
    squint: 1,
  },
  thinking: {
    body: {
      x: [0],
      y: [0, -6, 0, -6, 0],
      rotate: [0, -4, -4, 0],
      scaleY: [1, 1.006, 1, 1.006, 1],
      loops: {
        x: loop(1),
        y: loop(4.8),
        rotate: loop(4.8, [0, 0.22, 0.78, 1]),
        scaleY: loop(4.8),
      },
    },
    face: {
      x: [0, 7, 7, 0],
      y: [0, -11, -11, 0],
      loop: loop(4.8, [0, 0.22, 0.78, 1]),
    },
    crest: { rotate: [0, -2, 1, 0], loop: loop(4.8, [0, 0.35, 0.7, 1]) },
    beak: { rotate: [0], loop: loop(1) },
    squint: 1,
  },
  "tool-calling": {
    body: {
      x: [0, 8, 0, 0],
      y: [0, -5, 0],
      rotate: [0, 2.5, 0, 0],
      scaleY: [1, 1.01, 1],
      loops: {
        x: loop(1.4, [0, 0.22, 0.48, 1]),
        y: loop(0.9),
        rotate: loop(1.4, [0, 0.22, 0.48, 1]),
        scaleY: loop(0.9),
      },
    },
    face: {
      x: [0, 10, 10, 0],
      y: [0, 2, 2, 0],
      loop: loop(2.8, [0, 0.15, 0.85, 1]),
    },
    crest: { rotate: [0, -4, 2, 0], loop: loop(0.9, [0, 0.4, 0.75, 1]) },
    beak: { rotate: [0, 4, 0, 0], loop: loop(1.4, [0, 0.22, 0.48, 1]) },
    squint: 1,
  },
  processing: {
    body: {
      x: [0],
      y: [0, -8, 0],
      rotate: [0, -1.5, 0, 1.5, 0],
      scaleY: [1, 1.01, 1],
      loops: {
        x: loop(1),
        y: loop(1.8),
        rotate: loop(3.6),
        scaleY: loop(1.8),
      },
    },
    face: {
      x: [0, -9, -9, 9, 9, 0],
      y: [0, 2, 2, 2, 2, 0],
      loop: loop(3.6, [0, 0.15, 0.4, 0.55, 0.85, 1]),
    },
    crest: { rotate: [0, -5, 2, 0], loop: loop(0.7, [0, 0.4, 0.75, 1]) },
    beak: { rotate: [0], loop: loop(1) },
    squint: 0.82,
  },
  responding: {
    body: {
      x: [0],
      y: [0, -12, 0, -5, 0],
      rotate: [0, 1.5, 0, -1, 0],
      scaleY: [1, 1.02, 0.985, 1.01, 1],
      loops: {
        x: loop(1),
        y: loop(1.6, [0, 0.3, 0.55, 0.75, 1]),
        rotate: loop(1.6, [0, 0.3, 0.55, 0.75, 1]),
        scaleY: loop(1.6, [0, 0.3, 0.55, 0.75, 1]),
      },
    },
    face: { x: [0, 3, 0], y: [0, -3, 0], loop: loop(1.6) },
    crest: {
      rotate: [0, -5, 3, -1, 0],
      loop: loop(1.6, [0, 0.3, 0.55, 0.75, 1], 0.15),
    },
    beak: {
      rotate: [0, 3, 0, 2.5, 0, 0],
      loop: loop(1.6, [0, 0.12, 0.25, 0.4, 0.55, 1]),
    },
    squint: 1,
  },
}

const STATIC_POSES: Record<ColibriMascotState, StaticPose> = {
  idle: {
    body: { x: 0, y: 0, rotate: 0, scaleY: 1 },
    face: { x: 0, y: 0 },
    beak: 0,
    squint: 1,
  },
  loading: {
    body: { x: 0, y: 0, rotate: 0, scaleY: 1 },
    face: { x: 0, y: 0 },
    beak: 0,
    squint: 1,
  },
  thinking: {
    body: { x: 0, y: 0, rotate: -4, scaleY: 1 },
    face: { x: 7, y: -11 },
    beak: 0,
    squint: 1,
  },
  "tool-calling": {
    body: { x: 0, y: 0, rotate: 0, scaleY: 1 },
    face: { x: 10, y: 2 },
    beak: 2,
    squint: 1,
  },
  processing: {
    body: { x: 0, y: 0, rotate: 0, scaleY: 1 },
    face: { x: 0, y: 2 },
    beak: 0,
    squint: 0.82,
  },
  responding: {
    body: { x: 0, y: 0, rotate: 0, scaleY: 1 },
    face: { x: 0, y: -3 },
    beak: 2,
    squint: 1,
  },
}

/** A single blink, then a quick double blink, so the rhythm never feels mechanical. */
const BLINK = {
  scaleY: [1, 1, 0.08, 1, 1, 0.08, 1, 0.08, 1, 1],
  transition: {
    duration: 6.5,
    times: [0, 0.42, 0.44, 0.465, 0.84, 0.86, 0.88, 0.9, 0.925, 1],
    ease: "easeInOut" as const,
    repeat: Infinity,
  },
}

const HEAD_PATH =
  "M495 184C636 184 752 291 752 425C752 559 626 672 485 672C344 672 238 564 238 430C238 296 354 184 495 184Z"

const CREST = [
  {
    leaf: "M392 236C348 182 300 125 298 78C297 60 306 52 318 52C380 62 440 120 462 196Z",
    fold: "M392 236C348 182 300 125 298 78C297 62 304 54 312 53C316 100 334 160 402 226Z",
    origin: { originX: 0.85, originY: 1 },
    delay: 0,
    gain: 1,
  },
  {
    leaf: "M392 238C350 196 290 162 250 162C235 162 228 172 233 184C248 222 280 255 318 268Z",
    fold: "M233 184C248 222 280 255 318 268L372 230C330 222 272 208 236 180C234 181 233 182 233 184Z",
    origin: { originX: 1, originY: 0.8 },
    delay: 0.12,
    gain: 1.3,
  },
] as const

const EYES = [
  {
    eye: { cx: 481, cy: 456, rx: 59, ry: 72 },
    glint: { cx: 503, cy: 423, rx: 16, ry: 23, rotate: -15 },
  },
  {
    eye: { cx: 713, cy: 413, rx: 30, ry: 57 },
    glint: { cx: 717, cy: 386, rx: 11, ry: 17, rotate: 12 },
  },
] as const

const BEAK_PATH =
  "M864 542C812 522 740 486 680 467C646 458 610 476 602 503C597 522 605 537 621 533C642 528 664 520 698 521C760 525 815 547 855 563C869 568 876 549 864 542Z"
const BEAK_SHINE_PATH =
  "M648 485C704 484 774 508 834 537C774 520 706 503 646 498C637 496 638 486 648 485Z"

const THOUGHT_CLOUD_PATH =
  "M700 150A34 34 0 0 1 690 90A40 40 0 0 1 750 50A44 44 0 0 1 830 56A40 40 0 0 1 860 128A36 36 0 0 1 800 158A38 38 0 0 1 730 158A22 22 0 0 1 700 150Z"

/** Trail bubbles rise from the head toward the cloud, smallest first. */
const THOUGHT_TRAIL = [
  { cx: 716, cy: 250, r: 10, delay: 0 },
  { cx: 744, cy: 198, r: 15, delay: 0.1 },
] as const

const THOUGHT_DOTS = [742, 776, 810] as const

const STAR_PATH = "M0-26C4-6 6-4 26 0C6 4 4 6 0 26C-4 6-6 4-26 0C-6-4-4-6 0-26Z"

/** The bird shrinks while loading so the orbit clears its crest. */
const LOADING_BIRD_SCALE = 0.74

/** A half-circle over the shrunken bird, travelled left to right across the top. */
const ORBIT = { cx: 540, cy: 460, r: 335 }
const ORBIT_PATH = `M${ORBIT.cx - ORBIT.r} ${ORBIT.cy}A${ORBIT.r} ${ORBIT.r} 0 0 1 ${ORBIT.cx + ORBIT.r} ${ORBIT.cy}`
const ORBIT_LENGTH = Math.PI * ORBIT.r

/** The sweep fills the first part of each cycle; the rest lets the gaze settle. */
const STAR_CYCLE = { duration: 4.6, sweep: 0.6, linger: 0.1 }

/** Layered strokes of falling width and rising strength taper the tail toward the star. */
const STAR_TAIL = [
  { length: 0.3, width: 26, opacity: 0.1 },
  { length: 0.19, width: 13, opacity: 0.22 },
  { length: 0.11, width: 6, opacity: 0.5 },
] as const

/** How far the face travels, in viewBox units, when the gaze is at full stretch. */
const GAZE_REACH = { x: 11, y: 13 }

/** Sine easing keeps the star's speed a smooth harmonic curve, still at both ends. */
const sweepProgress = (cycle: number) => {
  if (cycle < 0) return 0
  const t = Math.min(cycle / STAR_CYCLE.sweep, 1)
  return (1 - Math.cos(Math.PI * t)) / 2
}

/** Unit vector from the bird toward the star, then a hold, then back to centre. */
const gazeTarget = (cycle: number): [number, number] => {
  if (cycle < 0) return [0, 0]
  if (cycle <= STAR_CYCLE.sweep) {
    const angle = Math.PI * sweepProgress(cycle)
    return [-Math.cos(angle), -Math.sin(angle)]
  }
  if (cycle <= STAR_CYCLE.sweep + STAR_CYCLE.linger) return [1, 0]
  return [0, 0]
}

/** An SVG-only, prop-controlled hummingbird mascot for agent activity. */
export function ColibriMascot({
  state = "idle",
  size = 64,
  color = "#D4FF00",
  featureColor = "#17181A",
  trailColor = "currentColor",
  decorative = false,
  width,
  height,
  role,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  ...svgProps
}: ColibriMascotProps) {
  const reducedMotion = useReducedMotion() ?? false
  const uid = useId().replace(/[^\w-]/g, "")
  const shadeId = `${uid}-shade`
  const blurId = `${uid}-blur`

  const thinking = state === "thinking"
  const loading = state === "loading"

  /** Position within the star's repeating cycle, or -1 when there is no star. */
  const cycle = useMotionValue(-1)
  useEffect(() => {
    if (!loading) {
      cycle.set(-1)
      return
    }
    if (reducedMotion) {
      cycle.set(STAR_CYCLE.sweep / 2)
      return
    }
    const controls = animate(cycle, [0, 1], {
      duration: STAR_CYCLE.duration,
      ease: "linear",
      repeat: Infinity,
    })
    return () => controls.stop()
  }, [cycle, loading, reducedMotion])

  const sweep = useTransform(cycle, sweepProgress)
  const starX = useTransform(
    sweep,
    (p) => ORBIT.cx - ORBIT.r * Math.cos(Math.PI * p),
  )
  const starY = useTransform(
    sweep,
    (p) => ORBIT.cy - ORBIT.r * Math.sin(Math.PI * p),
  )
  const starOpacity = useTransform(sweep, [0, 0.1, 0.9, 1], [0, 1, 1, 0])
  const starScale = useTransform(
    sweep,
    (p) => 0.55 + 0.5 * Math.sin(Math.PI * p),
  )
  const starSpin = useTransform(sweep, (p) => p * 180)

  const gazeSpring = { stiffness: 110, damping: 18, mass: 0.9 }
  const gazeX = useSpring(
    useTransform(cycle, (c) => gazeTarget(c)[0]),
    gazeSpring,
  )
  const gazeY = useSpring(
    useTransform(cycle, (c) => gazeTarget(c)[1]),
    gazeSpring,
  )
  const lookX = useTransform(gazeX, (g) => g * GAZE_REACH.x)
  const lookY = useTransform(gazeY, (g) => g * GAZE_REACH.y)
  const eyeX = useTransform(lookX, (v) => v * 0.6)
  const eyeY = useTransform(lookY, (v) => v * 0.6)
  const shineX = useTransform(lookX, (v) => v * -0.3)
  const shineY = useTransform(lookY, (v) => v * -0.3)
  const lean = useTransform(gazeX, (g) => g * 3)
  const config = STATE_MOTION[state]
  const pose = STATIC_POSES[state]
  const still = { duration: reducedMotion ? 0 : 0.35, ease: "easeOut" as const }

  const bodyAnimate = reducedMotion
    ? pose.body
    : {
        x: config.body.x,
        y: config.body.y,
        rotate: config.body.rotate,
        scaleY: config.body.scaleY,
      }
  const bodyTransition = reducedMotion ? still : config.body.loops

  const faceAnimate = (factor: number) =>
    reducedMotion
      ? { x: pose.face.x * factor, y: pose.face.y * factor }
      : { x: scale(config.face.x, factor), y: scale(config.face.y, factor) }
  const faceTransition = reducedMotion ? still : config.face.loop

  const floating = thinking && !reducedMotion
  const pop = (delay: number) =>
    floating
      ? {
          scale: {
            type: "spring" as const,
            stiffness: 520,
            damping: 14,
            delay,
          },
          opacity: { duration: 0.15, delay },
        }
      : { duration: reducedMotion ? 0 : 0.18, ease: "easeIn" as const }

  return (
    <svg
      {...svgProps}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="180 0 720 720"
      width={width ?? size}
      height={height ?? size}
      fill="none"
      role={decorative ? undefined : (role ?? "img")}
      aria-label={
        decorative
          ? undefined
          : (ariaLabel ?? `Sohizi agent ${state.replace("-", " ")}`)
      }
      aria-hidden={decorative ? true : ariaHidden}
      focusable="false"
    >
      <defs>
        <radialGradient id={shadeId} cx="0.4" cy="0.3" r="0.78">
          <stop offset="0" stopColor="white" stopOpacity="0.12" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
          <stop offset="0.86" stopColor={featureColor} stopOpacity="0.02" />
          <stop offset="1" stopColor={featureColor} stopOpacity="0.1" />
        </radialGradient>
        <filter id={blurId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>

      <motion.g
        initial={false}
        animate={{ scale: loading ? LOADING_BIRD_SCALE : 1 }}
        transition={
          reducedMotion
            ? still
            : { type: "spring", stiffness: 160, damping: 22, mass: 1 }
        }
        style={{ originX: 0.47, originY: 1 }}
      >
        <motion.g style={{ rotate: lean, originX: 0.5, originY: 0.85 }}>
          <motion.g
            initial={false}
            animate={bodyAnimate}
            transition={bodyTransition}
            style={{ originX: 0.5, originY: 0.85 }}
          >
            {CREST.map((feather) => (
              <motion.g
                key={feather.leaf}
                initial={false}
                animate={{
                  rotate: reducedMotion
                    ? 0
                    : scale(config.crest.rotate, feather.gain),
                }}
                transition={
                  reducedMotion
                    ? still
                    : {
                        ...config.crest.loop,
                        delay: (config.crest.loop.delay ?? 0) + feather.delay,
                      }
                }
                style={feather.origin}
              >
                <path d={feather.leaf} fill={color} />
                <path d={feather.fold} fill={featureColor} fillOpacity="0.14" />
              </motion.g>
            ))}

            <path d={HEAD_PATH} fill={color} />
            <path d={HEAD_PATH} fill={`url(#${shadeId})`} />

            <motion.g
              initial={false}
              animate={faceAnimate(1)}
              transition={faceTransition}
            >
              <motion.g style={{ x: lookX, y: lookY }}>
                <motion.g
                  initial={false}
                  animate={faceAnimate(0.6)}
                  transition={faceTransition}
                >
                  <motion.g style={{ x: eyeX, y: eyeY }}>
                    {EYES.map(({ eye, glint }) => (
                      <motion.g
                        key={eye.cx}
                        initial={false}
                        animate={{ scaleY: config.squint }}
                        transition={still}
                        style={{ originX: 0.5, originY: 0.5 }}
                      >
                        <motion.g
                          initial={false}
                          animate={
                            reducedMotion
                              ? { scaleY: 1 }
                              : { scaleY: BLINK.scaleY }
                          }
                          transition={reducedMotion ? still : BLINK.transition}
                          style={{ originX: 0.5, originY: 0.45 }}
                        >
                          <ellipse {...eye} fill={featureColor} />
                          <ellipse
                            cx={glint.cx}
                            cy={glint.cy}
                            rx={glint.rx}
                            ry={glint.ry}
                            transform={`rotate(${glint.rotate} ${glint.cx} ${glint.cy})`}
                            fill="white"
                            fillOpacity="0.95"
                          />
                        </motion.g>
                      </motion.g>
                    ))}
                  </motion.g>
                </motion.g>

                <motion.g
                  initial={false}
                  animate={{
                    rotate: reducedMotion ? pose.beak : config.beak.rotate,
                  }}
                  transition={reducedMotion ? still : config.beak.loop}
                  style={{ originX: 0.05, originY: 0.4 }}
                >
                  <path
                    d={BEAK_PATH}
                    stroke={color}
                    strokeWidth="12"
                    strokeLinejoin="round"
                  />
                  <path d={BEAK_PATH} fill={featureColor} />
                  <path d={BEAK_SHINE_PATH} fill="white" fillOpacity="0.3" />
                </motion.g>
              </motion.g>
            </motion.g>

            <motion.g
              initial={false}
              animate={faceAnimate(-0.3)}
              transition={faceTransition}
            >
              <motion.g style={{ x: shineX, y: shineY }}>
                <rect
                  x="570"
                  y="251"
                  width="108"
                  height="34"
                  rx="17"
                  transform="rotate(51 624 268)"
                  fill="white"
                  fillOpacity="0.92"
                />
                <ellipse
                  cx="692"
                  cy="296"
                  rx="10.5"
                  ry="26"
                  transform="rotate(-20 692 296)"
                  fill="white"
                  fillOpacity="0.88"
                />
              </motion.g>
            </motion.g>
          </motion.g>
        </motion.g>
      </motion.g>

      {loading && (
        <motion.g style={{ opacity: starOpacity }}>
          {STAR_TAIL.map((layer) => (
            <StarTail
              key={layer.width}
              {...layer}
              sweep={sweep}
              stroke={trailColor}
            />
          ))}
          <motion.g style={{ x: starX, y: starY }}>
            <motion.g
              style={{
                scale: starScale,
                rotate: starSpin,
                originX: 0.5,
                originY: 0.5,
              }}
            >
              <circle
                r="34"
                fill={color}
                fillOpacity="0.55"
                filter={`url(#${blurId})`}
              />
              <path
                d={STAR_PATH}
                transform="scale(1.5)"
                fill={color}
                stroke={featureColor}
                strokeWidth="4"
                strokeLinejoin="round"
              />
            </motion.g>
          </motion.g>
        </motion.g>
      )}

      {THOUGHT_TRAIL.map((bubble, index) => (
        <motion.g
          key={bubble.cx}
          initial={false}
          animate={{ opacity: thinking ? 1 : 0, scale: thinking ? 1 : 0.3 }}
          transition={pop(bubble.delay)}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          <motion.circle
            cx={bubble.cx}
            cy={bubble.cy}
            r={bubble.r}
            fill="white"
            stroke={featureColor}
            strokeWidth="5"
            initial={false}
            animate={{ y: floating ? [0, -5, 0] : 0 }}
            transition={floating ? loop(2.2, undefined, index * 0.3) : still}
          />
        </motion.g>
      ))}

      <motion.g
        initial={false}
        animate={{ opacity: thinking ? 1 : 0, scale: thinking ? 1 : 0.3 }}
        transition={pop(0.2)}
        style={{ originX: 0.15, originY: 1 }}
      >
        <motion.g
          initial={false}
          animate={
            floating
              ? { y: [0, -7, 0], scale: [1, 1.03, 1] }
              : { y: 0, scale: 1 }
          }
          transition={floating ? loop(2.6) : still}
          style={{ originX: 0.5, originY: 0.5 }}
        >
          <path
            d={THOUGHT_CLOUD_PATH}
            fill="white"
            stroke={featureColor}
            strokeWidth="6"
            strokeLinejoin="round"
          />
          {THOUGHT_DOTS.map((cx, index) => (
            <motion.circle
              key={cx}
              cx={cx}
              cy={106}
              r={10}
              fill={featureColor}
              initial={false}
              animate={
                floating
                  ? { y: [0, -10, 0, 0], opacity: [0.35, 1, 0.35, 0.35] }
                  : { y: 0, opacity: 1 }
              }
              transition={
                floating
                  ? loop(1.2, [0, 0.25, 0.5, 1], 0.45 + index * 0.15)
                  : still
              }
            />
          ))}
        </motion.g>
      </motion.g>
    </svg>
  )
}

/** A dash along the orbit ending at the star, longest when the star moves fastest. */
function StarTail({
  length,
  width,
  opacity,
  sweep,
  stroke,
}: {
  length: number
  width: number
  opacity: number
  sweep: MotionValue<number>
  stroke: string
}) {
  const dash = useTransform(
    sweep,
    (p) => length * Math.sin(Math.PI * p) * ORBIT_LENGTH,
  )
  const dashArray = useTransform(dash, (d) => `${d} ${ORBIT_LENGTH * 2}`)
  const dashOffset = useTransform(
    [dash, sweep] as Array<MotionValue<number>>,
    ([d, p]: Array<number>) => d - p * ORBIT_LENGTH,
  )

  return (
    <motion.path
      d={ORBIT_PATH}
      stroke={stroke}
      strokeOpacity={opacity}
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={dashArray}
      strokeDashoffset={dashOffset}
    />
  )
}
