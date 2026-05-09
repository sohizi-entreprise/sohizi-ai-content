export function framesToSeconds(frames: number, fps: number): number {
  if (fps <= 0) return 0
  return frames / fps
}

export function secondsToFrames(seconds: number, fps: number): number {
  if (fps <= 0) return 0
  return Math.round(seconds * fps)
}

export function clampFrame(frame: number, min: number, max: number): number {
  if (max < min) return min
  if (frame < min) return min
  if (frame > max) return max
  return frame
}

export function formatTimecode(frames: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 30
  const safeFrames = Math.max(0, Math.floor(frames))

  const totalMs = Math.floor((safeFrames / safeFps) * 1000)
  const minutes = Math.floor(totalMs / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000

  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  const mss = String(ms).padStart(3, '0').slice(0, 2)
  return `${mm}:${ss}.${mss}`
}

export function formatPlayerTimecode(frames: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 30
  const safeFrames = Math.max(0, Math.floor(frames))
  const totalSeconds = safeFrames / safeFps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const hundredths = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 100)
  const mm = String(minutes).padStart(1, '0')
  const ss = String(seconds).padStart(2, '0')
  const cc = String(hundredths).padStart(2, '0')
  return `${mm}:${ss}.${cc}`
}
