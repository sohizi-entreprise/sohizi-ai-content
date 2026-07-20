import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import { HtmlClip } from '../store/types'
import { prepareHtmlDocument } from '../utils/html-clip'

export const HyperframeSequence: React.FC<{ clip: HtmlClip }> = ({ clip }) => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const [renderHandle] = useState(() => delayRender(`hyperframe-${clip.id}`))

  const handleLoad = () => {
    continueRender(renderHandle)
  }

  useEffect(() => {
    try {
      const win = iframeRef.current?.contentWindow as
        | (Window & {
            __timelines?: Record<string, { pause: () => void; seek: (t: number) => void }>
          })
        | null
      if (!win?.__timelines) return

      const tl = win.__timelines[clip.id]
      if (tl && typeof tl.seek === 'function') {
        tl.pause()
        tl.seek(frame / fps)
      }
    } catch (err) {
      console.warn('Hyperframes sync waiting for iframe:', err)
    }
  }, [frame, fps, clip.id])

  const srcDoc = useMemo(
    () => prepareHtmlDocument(clip.html, clip.variables, clip.values),
    [clip.html, clip.variables, clip.values],
  )

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
          overflow: 'hidden',
        }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          onLoad={handleLoad}
          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
          sandbox="allow-scripts allow-same-origin"
        />
      </div>
    </AbsoluteFill>
  )
}
