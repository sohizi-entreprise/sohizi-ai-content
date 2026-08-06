'use client'

import { useId, useMemo } from 'react'
import Particles, {
  ParticlesProvider,
  useParticlesProvider,
} from '@tsparticles/react'
import type { Container, Engine, ISourceOptions } from '@tsparticles/engine'
import { loadSlim } from '@tsparticles/slim'
import { cn } from '@/lib/utils'
import { motion, useAnimation } from 'motion/react'

type SparklesProps = {
  id?: string
  className?: string
  background?: string
  particleSize?: number
  minSize?: number
  maxSize?: number
  speed?: number
  particleColor?: string
  particleDensity?: number
}

const initParticles = async (engine: Engine) => {
  await loadSlim(engine)
}

function SparklesCanvas({
  id,
  className,
  background,
  minSize,
  maxSize,
  speed,
  particleColor,
  particleDensity,
}: SparklesProps) {
  const { loaded } = useParticlesProvider()
  const controls = useAnimation()
  const generatedId = useId()

  const particlesLoaded = async (container?: Container) => {
    if (container) {
      void controls.start({
        opacity: 1,
        transition: {
          duration: 1,
        },
      })
    }
  }

  const options = useMemo<ISourceOptions>(
    () => ({
      background: {
        color: {
          value: background || '#0d47a1',
        },
      },
      fullScreen: {
        enable: false,
        zIndex: 1,
      },
      fpsLimit: 120,
      interactivity: {
        events: {
          onClick: {
            enable: true,
            mode: 'push',
          },
          onHover: {
            enable: false,
            mode: 'repulse',
          },
          resize: {
            enable: true,
          },
        },
        modes: {
          push: {
            quantity: 4,
          },
          repulse: {
            distance: 200,
            duration: 0.4,
          },
        },
      },
      particles: {
        color: {
          value: particleColor || '#ffffff',
        },
        move: {
          direction: 'none',
          enable: true,
          outModes: {
            default: 'out',
          },
          random: false,
          speed: {
            min: 0.1,
            max: 1,
          },
          straight: false,
        },
        number: {
          density: {
            enable: true,
            width: 400,
            height: 400,
          },
          value: particleDensity || 120,
        },
        opacity: {
          value: {
            min: 0.1,
            max: 1,
          },
          animation: {
            enable: true,
            speed: speed || 4,
            sync: false,
            startValue: 'random',
          },
        },
        shape: {
          type: 'circle',
        },
        size: {
          value: {
            min: minSize || 1,
            max: maxSize || 3,
          },
        },
      },
      detectRetina: true,
    }),
    [
      background,
      maxSize,
      minSize,
      particleColor,
      particleDensity,
      speed,
    ],
  )

  return (
    <motion.div animate={controls} className={cn('opacity-0', className)}>
      {loaded && (
        <Particles
          id={id || generatedId}
          className="h-full w-full"
          particlesLoaded={particlesLoaded}
          options={options}
        />
      )}
    </motion.div>
  )
}

export function SparklesCore(props: SparklesProps) {
  return (
    <ParticlesProvider init={initParticles}>
      <SparklesCanvas {...props} />
    </ParticlesProvider>
  )
}
