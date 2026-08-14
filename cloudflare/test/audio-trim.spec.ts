import { describe, expect, it } from 'vitest'
import worker from '../src/index'
import { createTestEnv } from './fakes'

/** 128 kbps, 44.1 kHz MPEG-1 Layer III frame: 417 bytes, ~26.1 ms. */
const FRAME_SIZE = 417
const FRAME_DURATION = 1152 / 44100

function buildMp3(frameCount: number): Uint8Array {
  const bytes = new Uint8Array(frameCount * FRAME_SIZE)
  for (let i = 0; i < frameCount; i++) {
    const offset = i * FRAME_SIZE
    bytes[offset] = 0xff
    bytes[offset + 1] = 0xfb
    bytes[offset + 2] = 0x90
    bytes[offset + 3] = 0x00
  }
  return bytes
}

function trimRequest(params: Record<string, string>): Request {
  const search = new URLSearchParams(params).toString()
  return new Request(`https://worker.test/?${search}`)
}

describe('audio trim route', () => {
  it('returns whole frames for the requested window', async () => {
    const { bucket, env } = createTestEnv()
    bucket.objects.set('audio/example.mp3', buildMp3(40))

    const response = await worker.fetch(
      trimRequest({ key: 'audio/example.mp3', offset: '0.2', duration: '0.3' }),
      env,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')

    const body = new Uint8Array(await response.arrayBuffer())
    expect(body.byteLength % FRAME_SIZE).toBe(0)

    // Frames are whole, so the window is rounded outwards: it must cover the
    // requested 300 ms without overshooting by more than a few frames.
    const frames = body.byteLength / FRAME_SIZE
    const requestedFrames = 0.3 / FRAME_DURATION
    expect(frames).toBeGreaterThanOrEqual(Math.floor(requestedFrames))
    expect(frames).toBeLessThanOrEqual(Math.ceil(requestedFrames) + 2)
    expect(body[0]).toBe(0xff)
  })

  it('keeps serving the legacy root path used by the API', async () => {
    const { bucket, env } = createTestEnv()
    bucket.objects.set('audio/example.mp3', buildMp3(10))

    const response = await worker.fetch(
      new Request('https://worker.test/trim?key=audio/example.mp3'),
      env,
    )

    expect(response.status).toBe(200)
  })

  it('answers HEAD without a body', async () => {
    const { bucket, env } = createTestEnv()
    bucket.objects.set('audio/example.mp3', buildMp3(10))

    const response = await worker.fetch(
      new Request('https://worker.test/?key=audio/example.mp3', { method: 'HEAD' }),
      env,
    )

    expect(response.status).toBe(200)
    expect(Number(response.headers.get('Content-Length'))).toBeGreaterThan(0)
    expect(await response.text()).toBe('')
  })

  it('rejects a missing key', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(new Request('https://worker.test/'), env)
    expect(response.status).toBe(400)
  })

  it('rejects a negative offset', async () => {
    const { bucket, env } = createTestEnv()
    bucket.objects.set('audio/example.mp3', buildMp3(4))
    const response = await worker.fetch(
      trimRequest({ key: 'audio/example.mp3', offset: '-1' }),
      env,
    )
    expect(response.status).toBe(400)
  })

  it('404s when the object is absent', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      trimRequest({ key: 'audio/missing.mp3' }),
      env,
    )
    expect(response.status).toBe(404)
  })

  it('refuses files above the memory budget', async () => {
    const { bucket, env } = createTestEnv({ MAX_MP3_BYTES: '100' })
    bucket.objects.set('audio/example.mp3', buildMp3(10))
    const response = await worker.fetch(
      trimRequest({ key: 'audio/example.mp3' }),
      env,
    )
    expect(response.status).toBe(413)
  })

  it('rejects write methods', async () => {
    const { env } = createTestEnv()
    const response = await worker.fetch(
      new Request('https://worker.test/?key=a.mp3', { method: 'POST' }),
      env,
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('Allow')).toBe('GET, HEAD')
  })
})
