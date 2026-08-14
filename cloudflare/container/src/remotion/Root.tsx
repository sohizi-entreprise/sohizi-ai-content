import { Composition } from 'remotion'
import { MAIN_COMPOSITION_ID, MainComposition } from '@sohizi/video-composition'
import type { Track } from '@sohizi/video-composition'

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

// `MainComposition` only reads `tracks` and accepts anything else. Pinning the
// component to `MainProps` is what lets `calculateMetadata` below read the
// dimensions out of the snapshot as numbers.
const Main: React.FC<MainProps> = MainComposition

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={MAIN_COMPOSITION_ID}
      component={Main}
      durationInFrames={fallbackProps.durationInFrames}
      fps={fallbackProps.fps}
      width={fallbackProps.width}
      height={fallbackProps.height}
      defaultProps={fallbackProps}
      // Dimensions and length come from the editor snapshot, so the export
      // matches whatever the canvas was showing.
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round(props.durationInFrames)),
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  )
}
