import { useEffect, useRef, useCallback } from 'react'

interface UseAutoScrollOptions {
  scrollRef: React.RefObject<HTMLElement | null>
  isStreaming: boolean
  scrollOnMount?: boolean
  threshold?: number
}

const DEFAULT_THRESHOLD = 40

export function useAutoScroll({
  scrollRef,
  isStreaming,
  scrollOnMount = true,
  threshold = DEFAULT_THRESHOLD,
}: UseAutoScrollOptions) {
  const isAutoScrollEnabled = useRef(true)
  const wasStreamingRef = useRef(false)
  const hasScrolledOnMount = useRef(false)

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold
  }, [scrollRef, threshold])

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [scrollRef])

  // Scroll to bottom on mount (once content is available)
  useEffect(() => {
    if (!scrollOnMount || hasScrolledOnMount.current) return
    const el = scrollRef.current
    if (!el) return

    // Wait a frame for content to render
    const raf = requestAnimationFrame(() => {
      scrollToBottom()
      hasScrolledOnMount.current = true
    })
    return () => cancelAnimationFrame(raf)
  }, [scrollOnMount, scrollRef, scrollToBottom])

  // Track user scroll to enable/disable auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      isAutoScrollEnabled.current = isNearBottom()
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollRef, isNearBottom])

  // During streaming, observe DOM mutations and scroll to bottom when content grows
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (isStreaming && !wasStreamingRef.current) {
      // Streaming just started — force-enable auto-scroll.
      // The user just sent a message, so they expect to follow the response.
      // They can scroll up during streaming to disable it.
      isAutoScrollEnabled.current = true
    }

    wasStreamingRef.current = isStreaming

    if (!isStreaming) return

    const observer = new MutationObserver(() => {
      if (isAutoScrollEnabled.current) {
        el.scrollTop = el.scrollHeight
      }
    })

    observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // Initial scroll for current content
    if (isAutoScrollEnabled.current) {
      el.scrollTop = el.scrollHeight
    }

    return () => observer.disconnect()
  }, [isStreaming, scrollRef, isNearBottom])

  return { scrollToBottom, isNearBottom }
}
