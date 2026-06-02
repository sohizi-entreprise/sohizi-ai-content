import { useEffect, useMemo, useRef, useState } from "react"
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion"
import { HtmlClip } from "../store/types"
import { prepareHtmlDocument } from "../utils/html-clip"

export const HyperframeSequence: React.FC<{ clip: HtmlClip }> = ({ clip }) => {
    const frame = useCurrentFrame()
    const { fps } = useVideoConfig()
    const iframeRef = useRef<HTMLIFrameElement>(null)
    
    // FIX 1: Use useState with a lazy initializer to prevent strict-mode double-invocation hangs
    const [renderHandle] = useState(() => delayRender(`hyperframe-${clip.id}`))
  
    const handleLoad = () => {
      // Clear the handle once iframe DOM is parsed
      continueRender(renderHandle)
    }
  
    useEffect(() => {
      try {
        const win = iframeRef.current?.contentWindow as any
        if (!win || !win.__timelines) return
    
        const tl = win.__timelines[clip.id]
        if (tl && typeof tl.seek === 'function') {
          tl.pause() // Ensure GSAP wall-clock isn't playing
          tl.seek(frame / fps)
        }
      } catch (err) {
        // Suppress hot-reload cross-origin errors in development
        console.warn("Hyperframes sync waiting for iframe:", err)
      }
    }, [frame, fps, clip.id]) // FIX 2: Added dependency array
  
    const srcDoc = useMemo(
        () => prepareHtmlDocument(clip.html, clip.variables, clip.values),
        [clip.html, clip.variables, clip.values]
    )
  
    return (
      <iframe
        ref={iframeRef}
        srcDoc={srcDoc}
        onLoad={handleLoad}
        style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
        // FIX 3: Added allow-same-origin so we can read win.__timelines
        sandbox="allow-scripts allow-same-origin"
      />
    )
}
