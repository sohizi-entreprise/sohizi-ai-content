'use client'

import { useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

export type Capability = {
  id: string
  label: string
  /** CSS color for the trace / node (hex, oklch, etc.) */
  color?: string
}

export type CapabilityHubProps = {
  hubLabel?: string
  capabilities?: Capability[]
  className?: string
  /** Show capability labels as connected components / mobile chips */
  showLabels?: boolean
}

const DEFAULT_COLORS = [
  '#38bdf8', // sky
  '#2dd4bf', // teal
  '#4ade80', // green
  '#a3e635', // lime (brand-adjacent)
  '#fbbf24', // amber
  '#fb923c', // orange
  '#f472b6', // pink
  '#67e8f9', // cyan
] as const

const DEFAULT_CAPABILITIES: Capability[] = [
  { id: 'text-editor', label: 'Text Editor' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'image-gen', label: 'Image Gen' },
  { id: 'video-gen', label: 'Video Gen' },
  { id: 'video-editor', label: 'Video Editor' },
  { id: 'speech', label: 'Speech' },
  { id: 'music', label: 'Music' },
  { id: 'ai-assistant', label: 'AI Assistant' },
]

const VIEW_W = 960
const VIEW_H = 600

type Anchor =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-left'

type Slot = {
  /** connection point where the trace meets the component pad */
  px: number
  py: number
  /** where the trace enters the hub (for gradient direction) */
  hx: number
  hy: number
  /** orthogonal trace path, drawn from pad -> hub so pulses flow inward */
  path: string
  /** optional 90-degree via/corner */
  corner?: [number, number]
  anchor: Anchor
}

/**
 * Eight compass slots routed with straight + 90-degree traces so the
 * capabilities sit at every angle (360 degrees) around the core.
 * cx=480 cy=300, hub half-size 100 x 40 -> edges L380 R580 T260 B340.
 */
const SLOTS: Slot[] = [
  // N — straight vertical
  { px: 480, py: 74, hx: 480, hy: 260, path: 'M480 74 L480 260', anchor: 'top' },
  // NE — right then down
  {
    px: 812,
    py: 138,
    hx: 580,
    hy: 260,
    corner: [580, 138],
    path: 'M812 138 L580 138 L580 260',
    anchor: 'right',
  },
  // E — straight horizontal
  { px: 852, py: 300, hx: 580, hy: 300, path: 'M852 300 L580 300', anchor: 'right' },
  // SE — right then up
  {
    px: 812,
    py: 462,
    hx: 580,
    hy: 340,
    corner: [580, 462],
    path: 'M812 462 L580 462 L580 340',
    anchor: 'right',
  },
  // S — straight vertical
  { px: 480, py: 526, hx: 480, hy: 340, path: 'M480 526 L480 340', anchor: 'bottom' },
  // SW — left then up
  {
    px: 148,
    py: 462,
    hx: 380,
    hy: 340,
    corner: [380, 462],
    path: 'M148 462 L380 462 L380 340',
    anchor: 'left',
  },
  // W — straight horizontal
  { px: 108, py: 300, hx: 380, hy: 300, path: 'M108 300 L380 300', anchor: 'left' },
  // NW — left then down
  {
    px: 148,
    py: 138,
    hx: 380,
    hy: 260,
    corner: [380, 138],
    path: 'M148 138 L380 138 L380 260',
    anchor: 'left',
  },
]

const HUB_ENTRIES: [number, number][] = [
  [480, 260],
  [480, 340],
  [380, 300],
  [580, 300],
  [580, 260],
  [380, 260],
  [580, 340],
  [380, 340],
]

const ANCHOR_TRANSFORM: Record<Anchor, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0, -50%)',
  'top-right': 'translate(0, -100%)',
  'bottom-right': 'translate(0, 0)',
  'bottom-left': 'translate(-100%, 0)',
  'top-left': 'translate(-100%, -100%)',
}

type Node = Slot & {
  id: string
  label: string
  color: string
  index: number
}

function Trace({
  node,
  uid,
  reduceMotion,
}: {
  node: Node
  uid: string
  reduceMotion: boolean
}) {
  const gradientId = `${uid}-grad-${node.id}`
  const duration = 2.6 + (node.index % 4) * 0.45
  const delay = node.index * 0.2

  return (
    <g>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={node.px}
          y1={node.py}
          x2={node.hx}
          y2={node.hy}
        >
          <stop offset="0" stopColor={node.color} stopOpacity="0.28" />
          <stop offset="1" stopColor={node.color} stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* Persistent trace */}
      <path
        d={node.path}
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
        opacity={0.6}
        pathLength={100}
      />

      {/* Data pulse flowing into the core */}
      {reduceMotion ? null : (
        <motion.path
          d={node.path}
          stroke={node.color}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          pathLength={100}
          strokeDasharray="7 93"
          initial={{ strokeDashoffset: 100 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration, repeat: Infinity, ease: 'linear', delay }}
          style={{ filter: `drop-shadow(0 0 4px ${node.color})` }}
        />
      )}

      {/* Corner via */}
      {node.corner && (
        <>
          <rect
            x={node.corner[0] - 3.5}
            y={node.corner[1] - 3.5}
            width={7}
            height={7}
            fill="oklch(0.18 0.01 265)"
            stroke={node.color}
            strokeWidth={1.5}
          />
        </>
      )}

      {/* Endpoint via pad at the component */}
      <circle
        cx={node.px}
        cy={node.py}
        r={8}
        fill={node.color}
        opacity={0.12}
        filter={`url(#${uid}-glow)`}
      />
      <circle
        cx={node.px}
        cy={node.py}
        r={4}
        fill="oklch(0.18 0.01 265)"
        stroke={node.color}
        strokeWidth={1.75}
      />
      <circle cx={node.px} cy={node.py} r={1.5} fill={node.color} />
    </g>
  )
}

export function CapabilityHub({
  hubLabel = 'Sohizi Lab',
  capabilities = DEFAULT_CAPABILITIES,
  className,
  showLabels = true,
}: CapabilityHubProps) {
  const reactId = useId().replace(/:/g, '')
  const uid = `cap-hub-${reactId}`
  const reduceMotion = useReducedMotion() ?? false

  const nodes: Node[] = capabilities.slice(0, SLOTS.length).map((cap, i) => ({
    ...SLOTS[i],
    id: cap.id,
    label: cap.label,
    color: cap.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    index: i,
  }))

  return (
    <div
      className={cn('w-full', className)}
      role="img"
      aria-label={`${hubLabel} connects ${capabilities.map((c) => c.label).join(', ')}`}
    >
      <div
        className="relative mx-auto w-full max-w-5xl"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          <defs>
            <filter
              id={`${uid}-glow`}
              x="-60%"
              y="-60%"
              width="220%"
              height="220%"
              colorInterpolationFilters="sRGB"
            >
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id={`${uid}-ambient`} cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="oklch(0.77 0.22 148)" stopOpacity="0.14" />
              <stop offset="0.6" stopColor="oklch(0.77 0.22 148)" stopOpacity="0.03" />
              <stop offset="1" stopColor="oklch(0.77 0.22 148)" stopOpacity="0" />
            </radialGradient>
            <pattern
              id={`${uid}-grid`}
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="oklch(0.77 0.22 148 / 0.05)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          {/* PCB grid + ambient core glow */}
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill={`url(#${uid}-grid)`} />
          <ellipse
            cx={VIEW_W / 2}
            cy={VIEW_H / 2}
            rx={VIEW_W * 0.4}
            ry={VIEW_H * 0.45}
            fill={`url(#${uid}-ambient)`}
          />

          {/* Hub landing pads */}
          {HUB_ENTRIES.map(([hx, hy], i) => (
            <rect
              key={`entry-${i}`}
              x={hx - 3}
              y={hy - 3}
              width={6}
              height={6}
              fill="oklch(0.77 0.22 148)"
              opacity={0.5}
            />
          ))}

          {nodes.map((node) => (
            <Trace
              key={node.id}
              node={node}
              uid={uid}
              reduceMotion={reduceMotion}
            />
          ))}
        </svg>

        {/* Center hub — the "chip" / brain core */}
        <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative grid place-items-center">
            {/* pulse rings */}
            {!reduceMotion &&
              [0, 1].map((ring) => (
                <motion.span
                  key={ring}
                  className="absolute inset-0 rounded-lg border border-primary/40"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 1.7, opacity: 0 }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: ring * 1.5,
                  }}
                />
              ))}

            <motion.div
              className="relative flex items-center gap-2 rounded-lg border border-primary/25 bg-[oklch(0.2_0.012_265/0.9)] px-5 py-3 backdrop-blur-md sm:px-6"
              initial={reduceMotion ? false : { scale: 0.94, opacity: 0 }}
              animate={
                reduceMotion
                  ? undefined
                  : {
                      scale: 1,
                      opacity: 1,
                      boxShadow: [
                        '0 0 20px 0 oklch(0.77 0.22 148 / 0.12)',
                        '0 0 38px 4px oklch(0.77 0.22 148 / 0.28)',
                        '0 0 20px 0 oklch(0.77 0.22 148 / 0.12)',
                      ],
                    }
              }
              transition={
                reduceMotion
                  ? undefined
                  : {
                      scale: { duration: 0.5, ease: 'easeOut' },
                      opacity: { duration: 0.4 },
                      boxShadow: {
                        duration: 3.2,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                    }
              }
            >
              {/* chip corner brackets */}
              <span className="pointer-events-none absolute -top-px -left-px h-2.5 w-2.5 rounded-tl-lg border-t-2 border-l-2 border-primary/70" />
              <span className="pointer-events-none absolute -top-px -right-px h-2.5 w-2.5 rounded-tr-lg border-t-2 border-r-2 border-primary/70" />
              <span className="pointer-events-none absolute -bottom-px -left-px h-2.5 w-2.5 rounded-bl-lg border-b-2 border-l-2 border-primary/70" />
              <span className="pointer-events-none absolute -right-px -bottom-px h-2.5 w-2.5 rounded-br-lg border-r-2 border-b-2 border-primary/70" />

              <span className="relative flex h-2 w-2">
                {!reduceMotion && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                )}
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_oklch(0.77_0.22_148)]" />
              </span>
              <span className="font-display text-sm font-semibold tracking-tight text-foreground sm:text-base">
                {hubLabel}
              </span>
            </motion.div>
          </div>
        </div>

        {/* Component labels wired to each trace endpoint */}
        {showLabels && (
          <div className="pointer-events-none absolute inset-0 hidden sm:block">
            {nodes.map((node) => (
              <span
                key={node.id}
                className="absolute flex items-center gap-1.5 rounded-md border bg-[oklch(0.2_0.012_265/0.6)] px-2 py-1 font-mono text-[11px] font-medium tracking-tight text-foreground/85 backdrop-blur-sm md:text-xs"
                style={{
                  left: `${(node.px / VIEW_W) * 100}%`,
                  top: `${(node.py / VIEW_H) * 100}%`,
                  transform: ANCHOR_TRANSFORM[node.anchor],
                  borderColor: `${node.color}44`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: node.color,
                    boxShadow: `0 0 6px ${node.color}`,
                  }}
                />
                {node.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mobile capability chips */}
      {showLabels && (
        <ul className="mt-6 flex flex-wrap justify-center gap-1.5 px-1 sm:hidden">
          {capabilities.map((cap, i) => {
            const color = cap.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
            return (
              <li
                key={cap.id}
                className="flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80"
                style={{
                  borderColor: `${color}44`,
                  backgroundColor: `${color}12`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {cap.label}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
