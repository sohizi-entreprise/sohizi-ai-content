import { HttpError } from '../http'
import type { RenderComposition } from './contracts'

/**
 * The container has internet access, so every URL it is asked to fetch has to
 * be pinned to hosts we own. Without this a crafted snapshot turns the renderer
 * into an SSRF proxy.
 */
export function parseAllowedHosts(value: string | undefined): Array<string> {
  return (value ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0)
}

function isHostAllowed(host: string, allowed: Array<string>): boolean {
  return allowed.some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  )
}

export function collectMediaHosts(composition: RenderComposition): Array<string> {
  const hosts = new Set<string>()
  for (const track of composition.tracks) {
    for (const clip of track.clips) {
      if (clip.type !== 'video' && clip.type !== 'audio' && clip.type !== 'image') {
        continue
      }
      try {
        hosts.add(new URL(clip.url).hostname.toLowerCase())
      } catch {
        throw new HttpError('bad_request', `Clip ${clip.id} has an unparsable url`)
      }
    }
  }
  return [...hosts]
}

export function assertMediaHostsAllowed(
  composition: RenderComposition,
  allowedHosts: Array<string>,
): void {
  if (allowedHosts.length === 0) {
    throw new HttpError(
      'internal_error',
      'RENDER_ALLOWED_MEDIA_HOSTS is not configured',
    )
  }

  const rejected = collectMediaHosts(composition).filter(
    (host) => !isHostAllowed(host, allowedHosts),
  )

  if (rejected.length > 0) {
    throw new HttpError('bad_request', 'Clip media host is not allowed', {
      hosts: rejected,
    })
  }
}
