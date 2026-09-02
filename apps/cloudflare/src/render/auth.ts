import { HttpError } from '../http'
import type { WorkerEnv } from '../env'

/** Constant-time comparison so token checks do not leak length or prefix. */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.byteLength !== right.byteLength) return false
  let mismatch = 0
  for (let i = 0; i < left.byteLength; i++) {
    mismatch |= left[i] ^ right[i]
  }
  return mismatch === 0
}

/**
 * Render routes are service-to-service only: the Sohizi API holds the token and
 * never exposes it to browsers.
 */
export function requireServiceToken(request: Request, env: WorkerEnv): void {
  const expected = env.RENDER_SERVICE_TOKEN
  if (!expected) {
    // Failing closed keeps an unconfigured deployment from becoming an open
    // render farm.
    throw new HttpError('unauthorized', 'Render service is not configured')
  }

  const header = request.headers.get('Authorization') ?? ''
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new HttpError('unauthorized', 'Missing bearer token')
  }

  if (!timingSafeEqual(token, expected)) {
    throw new HttpError('unauthorized', 'Invalid bearer token')
  }
}
