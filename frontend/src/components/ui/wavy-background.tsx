'use client'
import { useEffect, useRef, useState } from 'react'
import { createNoise3D } from 'simplex-noise'
import { cn } from '@/lib/utils'

export const WavyBackground = ({
  children,
  className,
  containerClassName,
  colors,
  waveWidth,
  backgroundFill,
  blur = 10,
  speed = 'fast',
  waveOpacity = 0.5,
  ...props
}: {
  children?: React.ReactNode
  className?: string
  containerClassName?: string
  colors?: Array<string>
  waveWidth?: number
  backgroundFill?: string
  blur?: number
  speed?: 'slow' | 'fast'
  waveOpacity?: number
  [key: string]: unknown
}) => {
  const noise = createNoise3D()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationIdRef = useRef(0)
  const ntRef = useRef(0)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })

  const getSpeed = () => {
    switch (speed) {
      case 'slow':
        return 0.001
      case 'fast':
        return 0.002
      default:
        return 0.001
    }
  }

  const waveColors = colors ?? [
    '#38bdf8',
    '#818cf8',
    '#c084fc',
    '#e879f9',
    '#22d3ee',
  ]

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctxRef.current = ctx

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { w: width, h: height }
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.filter = `blur(${blur}px)`
    }

    const drawWave = (n: number) => {
      const { w, h } = sizeRef.current
      if (!w || !h) return
      ntRef.current += getSpeed()
      for (let i = 0; i < n; i++) {
        ctx.beginPath()
        ctx.lineWidth = waveWidth || 50
        ctx.strokeStyle = waveColors[i % waveColors.length]
        for (let x = 0; x < w; x += 5) {
          const y = noise(x / 800, 0.3 * i, ntRef.current) * 100
          ctx.lineTo(x, y + h * 0.5)
        }
        ctx.stroke()
        ctx.closePath()
      }
    }

    const render = () => {
      const { w, h } = sizeRef.current
      if (w && h) {
        if (backgroundFill && backgroundFill !== 'transparent') {
          ctx.globalAlpha = waveOpacity || 0.5
          ctx.fillStyle = backgroundFill
          ctx.fillRect(0, 0, w, h)
        } else {
          ctx.clearRect(0, 0, w, h)
          ctx.globalAlpha = waveOpacity || 0.5
        }
        drawWave(5)
      }
      animationIdRef.current = requestAnimationFrame(render)
    }

    resize()
    render()

    const observer = new ResizeObserver(resize)
    observer.observe(container)
    window.addEventListener('resize', resize)

    return () => {
      cancelAnimationFrame(animationIdRef.current)
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [backgroundFill, blur, speed, waveOpacity, waveWidth, colors])

  const [isSafari, setIsSafari] = useState(false)
  useEffect(() => {
    setIsSafari(
      typeof window !== 'undefined' &&
        navigator.userAgent.includes('Safari') &&
        !navigator.userAgent.includes('Chrome'),
    )
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-screen flex-col items-center justify-center',
        containerClassName,
      )}
    >
      <canvas
        className="pointer-events-none absolute inset-0 z-0"
        ref={canvasRef}
        style={{
          ...(isSafari ? { filter: `blur(${blur}px)` } : {}),
        }}
      />
      <div className={cn('relative z-10', className)} {...props}>
        {children}
      </div>
    </div>
  )
}
