import { describe, expect, it } from 'vitest'
import { isRenderInputDocument } from '../container/src/protocol'

/**
 * The container re-validates the document the Workflow hands it, because a
 * malformed snapshot must fail fast instead of crashing mid-render.
 */
describe('container render input contract', () => {
  const valid = {
    jobId: 'job-1',
    projectId: 'p',
    compositionId: 'c',
    composition: {
      fps: 30,
      width: 1920,
      height: 1080,
      durationInFrames: 60,
      tracks: [],
    },
  }

  it('accepts the document the Worker persists', () => {
    expect(isRenderInputDocument(valid)).toBe(true)
  })

  it('rejects a missing job id', () => {
    expect(isRenderInputDocument({ ...valid, jobId: '' })).toBe(false)
  })

  it('rejects a zero-length composition', () => {
    expect(
      isRenderInputDocument({
        ...valid,
        composition: { ...valid.composition, durationInFrames: 0 },
      }),
    ).toBe(false)
  })

  it('rejects non-numeric dimensions', () => {
    expect(
      isRenderInputDocument({
        ...valid,
        composition: { ...valid.composition, width: 'wide' },
      }),
    ).toBe(false)
  })

  it('rejects tracks that are not an array', () => {
    expect(
      isRenderInputDocument({
        ...valid,
        composition: { ...valid.composition, tracks: {} },
      }),
    ).toBe(false)
  })

  it('rejects non-objects', () => {
    expect(isRenderInputDocument(null)).toBe(false)
    expect(isRenderInputDocument('nope')).toBe(false)
  })
})
