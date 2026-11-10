import { memo, useMemo } from "react"
import {
  AbsoluteFill,
  Html5Audio,
  Img,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
} from "remotion"
import type {
  AudioClip,
  ClipAnimationIn,
  ClipAnimationOut,
  ImageClip,
  ImageMotionEffect,
  ObjectFitMode,
  TextClip,
  VideoClip,
} from "./types"

const DEFAULT_ANIMATION_FRAMES = 12

function computeFadeMultiplier(
  frame: number,
  durationInFrames: number,
  fadeInFrames = 0,
  fadeOutFrames = 0,
): number {
  let mult = 1
  const safeFadeIn = Math.max(0, Math.floor(fadeInFrames))
  const safeFadeOut = Math.max(0, Math.floor(fadeOutFrames))

  if (safeFadeIn > 0) {
    mult *= interpolate(frame, [0, safeFadeIn], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  }

  if (safeFadeOut > 0 && durationInFrames > 0) {
    const outStart = Math.max(0, durationInFrames - safeFadeOut)
    mult *= interpolate(frame, [outStart, durationInFrames], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  }

  return Math.max(0, Math.min(1, mult))
}

function computeAnimationTransformAndOpacity(
  frame: number,
  durationInFrames: number,
  animationIn: ClipAnimationIn = "none",
  animationOut: ClipAnimationOut = "none",
): { opacityMultiplier: number; translateYPercent: number; scale: number } {
  let opacityMultiplier = 1
  let translateYPercent = 0
  let scale = 1

  const animFrames = Math.min(
    DEFAULT_ANIMATION_FRAMES,
    Math.max(1, Math.floor(durationInFrames / 2)),
  )

  if (animationIn !== "none") {
    const progressIn = interpolate(frame, [0, animFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
    if (animationIn === "fade") {
      opacityMultiplier *= progressIn
    } else if (animationIn === "slide-up") {
      opacityMultiplier *= progressIn
      translateYPercent += (1 - progressIn) * 18
    } else {
      opacityMultiplier *= progressIn
      scale *= 0.85 + 0.15 * progressIn
    }
  }

  if (animationOut !== "none" && durationInFrames > 0) {
    const outStart = Math.max(0, durationInFrames - animFrames)
    const progressOut = interpolate(
      frame,
      [outStart, durationInFrames],
      [0, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    )
    if (animationOut === "fade") {
      opacityMultiplier *= 1 - progressOut
    } else if (animationOut === "slide-down") {
      opacityMultiplier *= 1 - progressOut
      translateYPercent += progressOut * 18
    } else {
      opacityMultiplier *= 1 - progressOut
      scale *= 1 - 0.15 * progressOut
    }
  }

  return { opacityMultiplier, translateYPercent, scale }
}

function computeImageMotionTransform(
  frame: number,
  durationInFrames: number,
  motionEffect: ImageMotionEffect = "none",
): string {
  if (motionEffect === "none" || durationInFrames <= 1) {
    return "scale(1) translate(0%, 0%)"
  }

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  switch (motionEffect) {
    case "ken-burns-in": {
      const s = 1 + 0.1 * progress
      return `scale(${s.toFixed(4)})`
    }
    case "ken-burns-out": {
      const s = 1.1 - 0.1 * progress
      return `scale(${s.toFixed(4)})`
    }
    case "pan-left": {
      const tx = 4 - 8 * progress
      return `scale(1.1) translate(${tx.toFixed(3)}%, 0%)`
    }
    case "pan-right": {
      const tx = -4 + 8 * progress
      return `scale(1.1) translate(${tx.toFixed(3)}%, 0%)`
    }
    default:
      return "scale(1)"
  }
}

function colorWithOpacity(color: string, opacity: number): string {
  const clamped = Math.max(0, Math.min(1, opacity))
  const hexMatch = /^#([0-9a-fA-F]{6})$/.exec(color.trim())
  if (hexMatch) {
    const hex = hexMatch[1]
    const r = Number.parseInt(hex.slice(0, 2), 16)
    const g = Number.parseInt(hex.slice(2, 4), 16)
    const b = Number.parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${clamped})`
  }
  return color
}

interface MemoizedVideoMediaProps {
  src: string
  muted: boolean
  volume: number
  playbackRate: number
  trimBefore: number
  fit: ObjectFitMode
}

const MemoizedVideoMedia = memo(function MemoizedVideoMedia({
  src,
  muted,
  volume,
  playbackRate,
  trimBefore,
  fit,
}: MemoizedVideoMediaProps) {
  const videoStyle = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      objectFit: fit,
    }),
    [fit],
  )

  return (
    <OffthreadVideo
      src={src}
      muted={muted}
      volume={volume}
      playbackRate={playbackRate}
      trimBefore={trimBefore}
      pauseWhenBuffering={false}
      style={videoStyle}
    />
  )
})

interface MemoizedAudioMediaProps {
  src: string
  trimBefore: number
  volume: number
  playbackRate: number
}

const MemoizedAudioMedia = memo(function MemoizedAudioMedia({
  src,
  trimBefore,
  volume,
  playbackRate,
}: MemoizedAudioMediaProps) {
  return (
    <Html5Audio
      src={src}
      trimBefore={trimBefore}
      volume={volume}
      playbackRate={playbackRate}
      pauseWhenBuffering={false}
      preload="auto"
    />
  )
})

interface VideoClipRendererProps {
  clip: VideoClip
  muted: boolean
}

export function VideoClipRenderer({ clip, muted }: VideoClipRendererProps) {
  const frame = useCurrentFrame()
  const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame)
  const fadeMult = computeFadeMultiplier(
    frame,
    durationInFrames,
    clip.fadeInFrames,
    clip.fadeOutFrames,
  )
  const anim = computeAnimationTransformAndOpacity(
    frame,
    durationInFrames,
    clip.animationIn,
    clip.animationOut,
  )
  const effectiveOpacity = clip.opacity * fadeMult * anim.opacityMultiplier
  const isSilenced = muted || clip.volume <= 0
  const effectiveVolume = isSilenced ? 0 : clip.volume * fadeMult
  const blur = clip.blur ?? 0
  const brightness = clip.brightness ?? 100
  const hasFilter = blur > 0 || brightness !== 100

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${clip.xRatio * 100}%`,
          top: `${clip.yRatio * 100}%`,
          width: `${clip.widthRatio * 100}%`,
          height: `${clip.heightRatio * 100}%`,
          transform: `translate(-50%, calc(-50% + ${anim.translateYPercent}%)) scale(${anim.scale})`,
          opacity: effectiveOpacity,
          borderRadius: clip.borderRadius,
          overflow: "hidden",
          filter: hasFilter
            ? `blur(${blur}px) brightness(${brightness}%)`
            : undefined,
        }}
      >
        <MemoizedVideoMedia
          src={clip.url}
          muted={isSilenced}
          volume={effectiveVolume}
          playbackRate={clip.speed}
          trimBefore={clip.sourceStartFrame}
          fit={clip.fit ?? "contain"}
        />
      </div>
    </AbsoluteFill>
  )
}

interface AudioClipRendererProps {
  clip: AudioClip
  muted: boolean
}

export function AudioClipRenderer({ clip, muted }: AudioClipRendererProps) {
  const frame = useCurrentFrame()
  if (muted || clip.volume <= 0) return null
  const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame)
  const fadeMult = computeFadeMultiplier(
    frame,
    durationInFrames,
    clip.fadeInFrames,
    clip.fadeOutFrames,
  )
  return (
    <MemoizedAudioMedia
      src={clip.url}
      trimBefore={clip.sourceStartFrame}
      volume={clip.volume * fadeMult}
      playbackRate={clip.speed}
    />
  )
}

interface TextClipRendererProps {
  clip: TextClip
}

export function TextClipRenderer({ clip }: TextClipRendererProps) {
  const frame = useCurrentFrame()
  const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame)
  const fadeMult = computeFadeMultiplier(
    frame,
    durationInFrames,
    clip.fadeInFrames,
    clip.fadeOutFrames,
  )
  const anim = computeAnimationTransformAndOpacity(
    frame,
    durationInFrames,
    clip.animationIn,
    clip.animationOut,
  )
  const effectiveOpacity = clip.opacity * fadeMult * anim.opacityMultiplier

  const justify =
    clip.align === "left"
      ? "flex-start"
      : clip.align === "right"
        ? "flex-end"
        : "center"

  const bgOpacity = clip.backgroundOpacity ?? (clip.backgroundColor ? 0.75 : 0)
  const showBg = Boolean(clip.backgroundColor) && bgOpacity > 0

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${clip.xRatio * 100}%`,
          top: `${clip.yRatio * 100}%`,
          width: `${clip.widthRatio * 100}%`,
          height: `${clip.heightRatio * 100}%`,
          transform: `translate(-50%, calc(-50% + ${anim.translateYPercent}%)) scale(${anim.scale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: justify,
          opacity: effectiveOpacity,
        }}
      >
        <div
          style={{
            color: clip.color,
            fontSize: clip.fontSize,
            fontWeight: clip.fontWeight,
            fontFamily: `${clip.fontFamily}, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
            textAlign: clip.align,
            whiteSpace: "pre-wrap",
            lineHeight: 1.2,
            width: showBg ? "auto" : "100%",
            maxWidth: "100%",
            backgroundColor:
              showBg && clip.backgroundColor
                ? colorWithOpacity(clip.backgroundColor, bgOpacity)
                : undefined,
            padding: showBg ? "0.25em 0.55em" : undefined,
            borderRadius:
              clip.borderRadius !== undefined
                ? clip.borderRadius
                : showBg
                  ? 12
                  : undefined,
            textShadow: clip.textShadow
              ? "0 2px 10px rgba(0, 0, 0, 0.85), 0 1px 3px rgba(0, 0, 0, 0.9)"
              : undefined,
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
  const frame = useCurrentFrame()
  const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame)
  const fadeMult = computeFadeMultiplier(
    frame,
    durationInFrames,
    clip.fadeInFrames,
    clip.fadeOutFrames,
  )
  const anim = computeAnimationTransformAndOpacity(
    frame,
    durationInFrames,
    clip.animationIn,
    clip.animationOut,
  )
  const effectiveOpacity = clip.opacity * fadeMult * anim.opacityMultiplier
  const motionTransform = computeImageMotionTransform(
    frame,
    durationInFrames,
    clip.motionEffect,
  )

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${clip.xRatio * 100}%`,
          top: `${clip.yRatio * 100}%`,
          width: `${clip.widthRatio * 100}%`,
          height: `${clip.heightRatio * 100}%`,
          transform: `translate(-50%, calc(-50% + ${anim.translateYPercent}%)) scale(${anim.scale})`,
          opacity: effectiveOpacity,
          borderRadius: clip.borderRadius,
          overflow: "hidden",
          filter: `blur(${clip.blur}px) brightness(${clip.brightness}%)`,
        }}
      >
        <Img
          src={clip.url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: clip.fit ?? "contain",
            transform: motionTransform,
            transformOrigin: "center center",
          }}
        />
      </div>
    </AbsoluteFill>
  )
}
