import { describe, expect, it } from 'vitest'
import {
  assertMediaHostsAllowed,
  collectMediaHosts,
  parseAllowedHosts,
} from '../src/render/media-hosts'
import type { RenderComposition } from '../src/render/contracts'

function compositionWithUrls(urls: Array<string>): RenderComposition {
  return {
    fps: 30,
    width: 1920,
    height: 1080,
    durationInFrames: 30,
    tracks: [
      {
        id: 'track-1',
        type: 'video',
        name: 'Video',
        muted: false,
        hidden: false,
        clips: urls.map((url, index) => ({
          id: `clip-${index}`,
          trackId: 'track-1',
          type: 'image' as const,
          startFrame: 0,
          endFrame: 30,
          sourceStartFrame: 0,
          sourceDurationInFrames: 30,
          url,
          fileName: 'asset.png',
          opacity: 1,
          borderRadius: 0,
          blur: 0,
          brightness: 100,
          xRatio: 0.5,
          yRatio: 0.5,
          widthRatio: 1,
          heightRatio: 1,
        })),
      },
    ],
  }
}

describe('media host allowlist', () => {
  it('parses a comma separated list', () => {
    expect(parseAllowedHosts(' cdn.sohizi.com , R2.DEV ,')).toEqual([
      'cdn.sohizi.com',
      'r2.dev',
    ])
  })

  it('collects unique hosts from media clips', () => {
    const hosts = collectMediaHosts(
      compositionWithUrls([
        'https://cdn.sohizi.com/a.png',
        'https://cdn.sohizi.com/b.png',
      ]),
    )
    expect(hosts).toEqual(['cdn.sohizi.com'])
  })

  it('accepts subdomains of an allowed host', () => {
    expect(() =>
      assertMediaHostsAllowed(
        compositionWithUrls(['https://media.cdn.sohizi.com/a.png']),
        ['cdn.sohizi.com'],
      ),
    ).not.toThrow()
  })

  it('rejects lookalike hosts', () => {
    expect(() =>
      assertMediaHostsAllowed(
        compositionWithUrls(['https://cdn.sohizi.com.evil.io/a.png']),
        ['cdn.sohizi.com'],
      ),
    ).toThrow(/not allowed/)
  })

  it('refuses to render when no allowlist is configured', () => {
    expect(() =>
      assertMediaHostsAllowed(compositionWithUrls([]), []),
    ).toThrow(/RENDER_ALLOWED_MEDIA_HOSTS/)
  })
})
