const PEAK_BUCKETS = 2048
const cache = new Map<string, Promise<AudioPeaksResult>>()

let sharedAudioContext: AudioContext | null = null

export interface AudioPeaksResult {
  peaks: Float32Array
  durationSec: number
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (sharedAudioContext) return sharedAudioContext
  const w = window as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  const Ctor = w.AudioContext ?? w.webkitAudioContext
  if (!Ctor) return null
  sharedAudioContext = new Ctor()
  return sharedAudioContext
}

export function getAudioPeaks(
  clipId: string,
  url: string,
): Promise<AudioPeaksResult> {
  const cached = cache.get(clipId)
  if (cached) return cached
  const promise = extractPeaks(url)
    .then((result) => {
      // Don't keep empty/failed decodes in cache — retry next mount.
      if (result.durationSec <= 0 || result.peaks.every((v) => v === 0)) {
        cache.delete(clipId)
      }
      return result
    })
    .catch((err) => {
      cache.delete(clipId)
      throw err
    })
  cache.set(clipId, promise)
  return promise
}

/** Slice full-file peaks to the trimmed source window used by a clip. */
export function sliceAudioPeaks(
  peaks: Float32Array,
  fullDurationSec: number,
  startSec: number,
  durationSec: number,
): Float32Array {
  if (peaks.length === 0 || fullDurationSec <= 0 || durationSec <= 0) {
    return peaks
  }
  const startRatio = Math.max(0, Math.min(1, startSec / fullDurationSec))
  const endRatio = Math.max(
    startRatio,
    Math.min(1, (startSec + durationSec) / fullDurationSec),
  )
  const startIdx = Math.floor(startRatio * peaks.length)
  const endIdx = Math.max(startIdx + 1, Math.ceil(endRatio * peaks.length))
  return peaks.subarray(startIdx, endIdx)
}

async function extractPeaks(url: string): Promise<AudioPeaksResult> {
  const empty = {
    peaks: new Float32Array(PEAK_BUCKETS),
    durationSec: 0,
  }
  const ctx = getAudioContext()
  if (!ctx) return empty

  const response = await fetch(url)
  if (!response.ok) return empty
  const arrayBuffer = await response.arrayBuffer()

  const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
    ctx
      .decodeAudioData(
        arrayBuffer.slice(0),
        (b) => resolve(b),
        (err) => reject(err),
      )
      .catch(reject)
  })

  const left = audioBuffer.getChannelData(0)
  const right =
    audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : null
  const samplesPerBucket = Math.max(1, Math.floor(left.length / PEAK_BUCKETS))
  const peaks = new Float32Array(PEAK_BUCKETS)

  for (let i = 0; i < PEAK_BUCKETS; i += 1) {
    let max = 0
    let sumSq = 0
    let count = 0
    const start = i * samplesPerBucket
    const end = Math.min(left.length, start + samplesPerBucket)
    for (let j = start; j < end; j += 1) {
      const l = left[j] ?? 0
      const r = right?.[j] ?? l
      const v = Math.max(Math.abs(l), Math.abs(r))
      if (v > max) max = v
      sumSq += ((l + r) * 0.5) ** 2
      count += 1
    }
    // Blend peak + RMS so quiet passages keep body and loud hits stay sharp.
    const rms = count > 0 ? Math.sqrt(sumSq / count) : 0
    peaks[i] = Math.min(1, max * 0.65 + rms * 0.55)
  }
  return { peaks, durationSec: audioBuffer.duration }
}
