import { useEffect, useRef, useCallback } from 'react'

interface UseAutoScrollOptions {
  scrollRef: React.RefObject<HTMLElement | null>
  contentRef?: React.RefObject<HTMLElement | null>
  isStreaming: boolean
  scrollOnMount?: boolean
  threshold?: number
}

const DEFAULT_THRESHOLD = 40

export function useAutoScroll({
  scrollRef,
  contentRef,
  isStreaming,
  scrollOnMount = true,
  threshold = DEFAULT_THRESHOLD,
}: UseAutoScrollOptions) {
  const isAutoScrollEnabled = useRef(true)
  const wasStreamingRef = useRef(false)
  const hasScrolledOnMount = useRef(false)
  const scrollRafRef = useRef<number | null>(null)

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

  const scheduleScrollToBottom = useCallback(() => {
    if (!isAutoScrollEnabled.current) return
    if (scrollRafRef.current !== null) return

    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      scrollToBottom()
    })
  }, [scrollToBottom])

  useEffect(() => {
    if (!scrollOnMount || hasScrolledOnMount.current) return
    const el = scrollRef.current
    if (!el) return

    const raf = requestAnimationFrame(() => {
      scrollToBottom()
      hasScrolledOnMount.current = true
    })
    return () => cancelAnimationFrame(raf)
  }, [scrollOnMount, scrollRef, scrollToBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => {
      isAutoScrollEnabled.current = isNearBottom()
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [scrollRef, isNearBottom])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (isStreaming && !wasStreamingRef.current) {
      isAutoScrollEnabled.current = true
    }

    wasStreamingRef.current = isStreaming

    if (!isStreaming) return

    if (isAutoScrollEnabled.current) {
      scheduleScrollToBottom()
    }

    const observed = contentRef?.current ?? el.firstElementChild
    if (!(observed instanceof HTMLElement)) return

    const observer = new ResizeObserver(() => {
      scheduleScrollToBottom()
    })

    observer.observe(observed)
    return () => {
      observer.disconnect()
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = null
      }
    }
  }, [isStreaming, scrollRef, contentRef, scheduleScrollToBottom])

  return { scrollToBottom, isNearBottom }
}
