import type { DetailedHTMLProps, HTMLAttributes } from 'react'

export type HyperframesPlayerElement = HTMLElement & {
  iframeElement: HTMLIFrameElement
  currentTime: number
  duration: number
  paused: boolean
  ready: boolean
}

type HyperframesPlayerProps = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  src?: string
  controls?: boolean
  muted?: boolean
  autoplay?: boolean
  loop?: boolean
  poster?: string
  width?: number | string
  height?: number | string
  'playback-rate'?: number | string
  'audio-src'?: string
  'audio-locked'?: boolean
  ref?: React.Ref<HyperframesPlayerElement>
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hyperframes-player': HyperframesPlayerProps
    }
  }
}

export {}
