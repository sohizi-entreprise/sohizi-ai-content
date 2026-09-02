export function framesToSeconds(frames: number, fps: number): number {
  if (fps <= 0) return 0
  return frames / fps
}

export function secondsToFrames(seconds: number, fps: number): number {
  if (fps <= 0) return 0
  return Math.round(seconds * fps)
}

export function formatPlayerTimecode(frames: number, fps: number): string {
  const safeFps = fps > 0 ? fps : 30
  const safeFrames = Math.max(0, Math.floor(frames))
  const totalSeconds = safeFrames / safeFps
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const hundredths = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 100)
  const mm = String(minutes).padStart(1, "0")
  const ss = String(seconds).padStart(2, "0")
  const cc = String(hundredths).padStart(2, "0")
  return `${mm}:${ss}.${cc}`
}
