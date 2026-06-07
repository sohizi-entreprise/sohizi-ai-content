export function probeImageDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const cleanup = () => {
      img.onload = null
      img.onerror = null
    }
    img.onload = () => {
      cleanup()
      const w = img.naturalWidth || img.width || 1
      const h = img.naturalHeight || img.height || 1
      resolve({ width: w, height: h })
    }
    img.onerror = () => {
      cleanup()
      reject(new Error('Failed to read image dimensions'))
    }
    img.src = url
  })
}

export function probeMediaDuration(
  url: string,
  kind: 'video' | 'audio',
): Promise<number> {
  return new Promise((resolve, reject) => {
    const el =
      kind === 'video'
        ? document.createElement('video')
        : document.createElement('audio')
    el.preload = 'metadata'
    el.muted = true
    if ('playsInline' in el) {
      ;(el as HTMLVideoElement).playsInline = true
    }

    const onLoaded = () => {
      cleanup()
      const dur =
        Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 5
      resolve(dur)
    }
    const onError = () => {
      cleanup()
      reject(new Error('Failed to read media metadata'))
    }
    const cleanup = () => {
      el.removeEventListener('loadedmetadata', onLoaded)
      el.removeEventListener('error', onError)
    }
    el.addEventListener('loadedmetadata', onLoaded)
    el.addEventListener('error', onError)
    el.src = url
  })
}
