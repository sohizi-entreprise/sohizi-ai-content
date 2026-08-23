import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const DOT_GAP = 12
const BASE_RADIUS = 0.55
const PEAK_RADIUS = 2.35
const BASE_ALPHA = 0.14
const PEAK_ALPHA = 0.62
const DEFAULT_CIRCLE_SIZE = 0.44

type DotGridLoaderProps = {
  className?: string
  progress?: number
  /** Spotlight radius as a fraction of the shorter side. */
  circleSize?: number
  /** CSS color for the dots. Defaults to muted-foreground. */
  dotColor?: string
}

export function DotGridLoader({
  className,
  progress,
  circleSize = DEFAULT_CIRCLE_SIZE,
  dotColor,
}: DotGridLoaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const circleSizeRef = useRef(circleSize)
  circleSizeRef.current = circleSize

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let frame = 0
    let visible = true
    let running = true
    const startedAt = performance.now()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      width = rect.width
      height = rect.height
      canvas.width = Math.max(1, Math.round(width * dpr))
      canvas.height = Math.max(1, Math.round(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const colorOf = () => {
      const parsed = getComputedStyle(container).color.match(/[\d.]+/g)
      if (!parsed || parsed.length < 3) return { r: 128, g: 128, b: 136 }
      return { r: Number(parsed[0]), g: Number(parsed[1]), b: Number(parsed[2]) }
    }

    const draw = (now: number) => {
      if (width < 1 || height < 1) return

      const t = (now - startedAt) / 1000
      const cx = width * (reduceMotion ? 0.5 : 0.5 + 0.34 * Math.sin(t * 0.62))
      const cy = height * (reduceMotion ? 0.5 : 0.5 + 0.3 * Math.sin(t * 0.41 + 1.15))
      const spotlight = Math.min(width, height) * Math.max(circleSizeRef.current, 0.05)
      const { r, g, b } = colorOf()

      ctx.clearRect(0, 0, width, height)

      const cols = Math.ceil(width / DOT_GAP) + 1
      const rows = Math.ceil(height / DOT_GAP) + 1
      const originX = (width - (cols - 1) * DOT_GAP) / 2
      const originY = (height - (rows - 1) * DOT_GAP) / 2

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const x = originX + col * DOT_GAP
          const y = originY + row * DOT_GAP
          const distance = Math.hypot(x - cx, y - cy)
          const falloff = Math.max(0, 1 - distance / spotlight)
          const influence = falloff * falloff * (3 - 2 * falloff)
          const radius = BASE_RADIUS + (PEAK_RADIUS - BASE_RADIUS) * influence
          const alpha = BASE_ALPHA + (PEAK_ALPHA - BASE_ALPHA) * influence

          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
          ctx.fill()
        }
      }
    }

    const tick = (now: number) => {
      if (!running) return
      if (visible) draw(now)
      frame = requestAnimationFrame(tick)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
    })
    intersectionObserver.observe(container)

    resize()
    frame = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('relative size-full overflow-hidden bg-background text-muted-foreground', className)}
      style={dotColor ? { color: dotColor } : undefined}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 size-full" />
      {progress != null && (
        <span className="absolute right-2 bottom-2 rounded-full bg-foreground/30 px-2 py-0.5 text-[10px] font-medium text-background tabular-nums">
          {Math.round(progress)}%
        </span>
      )}
    </div>
  )
}
