const PEAK_BUCKETS = 240
const cache = new Map<string, Promise<Float32Array>>()

let sharedAudioContext: AudioContext | null = null

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
): Promise<Float32Array> {
  const cached = cache.get(clipId)
  if (cached) return cached
  const promise = extractPeaks(url)
  cache.set(clipId, promise)
  return promise
}

export function clearWaveformCache(clipId: string): void {
  cache.delete(clipId)
}

async function extractPeaks(url: string): Promise<Float32Array> {
  const ctx = getAudioContext()
  if (!ctx) return new Float32Array(PEAK_BUCKETS)

  const response = await fetch(url)
  if (!response.ok) return new Float32Array(PEAK_BUCKETS)
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

  const channelData = audioBuffer.getChannelData(0)
  const samplesPerBucket = Math.max(
    1,
    Math.floor(channelData.length / PEAK_BUCKETS),
  )
  const peaks = new Float32Array(PEAK_BUCKETS)
  for (let i = 0; i < PEAK_BUCKETS; i += 1) {
    let max = 0
    const start = i * samplesPerBucket
    const end = Math.min(channelData.length, start + samplesPerBucket)
    for (let j = start; j < end; j += 1) {
      const v = Math.abs(channelData[j])
      if (v > max) max = v
    }
    peaks[i] = max
  }
  return peaks
}
