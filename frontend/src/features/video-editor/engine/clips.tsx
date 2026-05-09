import { AbsoluteFill, Html5Audio, Img, OffthreadVideo } from 'remotion'
import type {
  AudioClip,
  ImageClip,
  TextClip,
  VideoClip,
} from '../store/types'

interface VideoClipRendererProps {
  clip: VideoClip
  muted: boolean
}

export function VideoClipRenderer({ clip, muted }: VideoClipRendererProps) {
  return (
    <AbsoluteFill
      style={{
        opacity: clip.opacity,
        borderRadius: clip.borderRadius,
        overflow: 'hidden',
      }}
    >
      <OffthreadVideo
        src={clip.url}
        muted={muted}
        volume={muted ? 0 : clip.volume}
        playbackRate={clip.speed}
        trimBefore={clip.sourceStartFrame}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </AbsoluteFill>
  )
}

interface AudioClipRendererProps {
  clip: AudioClip
  muted: boolean
}

export function AudioClipRenderer({ clip, muted }: AudioClipRendererProps) {
  if (muted) return null
  return (
    <Html5Audio
      src={clip.url}
      trimBefore={clip.sourceStartFrame}
      volume={clip.volume}
      playbackRate={clip.speed}
    />
  )
}

interface TextClipRendererProps {
  clip: TextClip
}

export function TextClipRenderer({ clip }: TextClipRendererProps) {
  const justify =
    clip.align === 'left'
      ? 'flex-start'
      : clip.align === 'right'
        ? 'flex-end'
        : 'center'
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${clip.xRatio * 100}%`,
          top: `${clip.yRatio * 100}%`,
          width: `${clip.widthRatio * 100}%`,
          height: `${clip.heightRatio * 100}%`,
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: justify,
          opacity: clip.opacity,
        }}
      >
        <div
          style={{
            color: clip.color,
            fontSize: clip.fontSize,
            fontWeight: clip.fontWeight,
            fontFamily: `${clip.fontFamily}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
            textAlign: clip.align,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.2,
            width: '100%',
          }}
        >
          {clip.text}
        </div>
      </div>
    </AbsoluteFill>
  )
}

interface ImageClipRendererProps {
  clip: ImageClip
}

export function ImageClipRenderer({ clip }: ImageClipRendererProps) {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${clip.xRatio * 100}%`,
          top: `${clip.yRatio * 100}%`,
          width: `${clip.widthRatio * 100}%`,
          height: `${clip.heightRatio * 100}%`,
          transform: 'translate(-50%, -50%)',
          opacity: clip.opacity,
          borderRadius: clip.borderRadius,
          overflow: 'hidden',
          filter: `blur(${clip.blur}px) brightness(${clip.brightness}%)`,
        }}
      >
        <Img
          src={clip.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    </AbsoluteFill>
  )
}
