const THUMB_HEIGHT = 48
const THUMB_COUNT = 6

const cache = new Map<string, Promise<Array<string>>>()

export function getVideoThumbnails(
  clipId: string,
  url: string,
  durationSec: number,
): Promise<Array<string>> {
  const cached = cache.get(clipId)
  if (cached) return cached

  const promise = extractThumbnails(url, durationSec)
  cache.set(clipId, promise)
  return promise
}

export function clearThumbnailCache(clipId: string): void {
  cache.delete(clipId)
}

async function extractThumbnails(
  url: string,
  durationSec: number,
): Promise<Array<string>> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = url

  await new Promise<void>((resolve, reject) => {
    const onLoaded = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
      reject(new Error('failed to load video for thumbnails'))
    }
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
  })

  const total = Math.max(0.001, durationSec || video.duration || 1)
  const aspect = video.videoHeight
    ? video.videoWidth / video.videoHeight
    : 16 / 9
  const width = Math.max(32, Math.round(THUMB_HEIGHT * aspect))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = THUMB_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  const out: Array<string> = []
  for (let i = 0; i < THUMB_COUNT; i += 1) {
    const t = (total * (i + 0.5)) / THUMB_COUNT
    try {
      await seekVideo(video, Math.min(t, Math.max(0, total - 0.05)))
      ctx.drawImage(video, 0, 0, width, THUMB_HEIGHT)
      out.push(canvas.toDataURL('image/jpeg', 0.7))
    } catch {
      // best-effort; skip frame on failure
    }
  }

  return out
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      reject(new Error('seek failed'))
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    try {
      video.currentTime = time
    } catch (err) {
      reject(err as Error)
    }
  })
}
