import type { FC } from "react"
import { Composition } from "remotion"
import { MAIN_COMPOSITION_ID, MainComposition } from "@sohizi/video-composition"
import type { Track } from "@sohizi/video-composition"

export type MainProps = {
  tracks: Array<Track>
  fps: number
  width: number
  height: number
  durationInFrames: number
  [key: string]: unknown
}

const fallbackProps: MainProps = {
  tracks: [],
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 30,
}

const Main: FC<MainProps> = MainComposition

export const RemotionRoot: FC = () => {
  return (
    <Composition
      id={MAIN_COMPOSITION_ID}
      component={Main}
      durationInFrames={fallbackProps.durationInFrames}
      fps={fallbackProps.fps}
      width={fallbackProps.width}
      height={fallbackProps.height}
      defaultProps={fallbackProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.durationInFrames)),
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  )
}
