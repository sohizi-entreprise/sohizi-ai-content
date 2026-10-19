import { describe, expect, test } from "bun:test"
import {
  chunkCountForDuration,
  DEFAULT_RENDER_CONCURRENCY,
  estimatedLambdaDurationMs,
  framesPerLambdaForDuration,
  lambdaUsdToCredits,
  lambdasInvokedForDuration,
  MS_PER_FRAME_AT_1080P,
  resolutionScale,
} from "./render-pricing"

describe("framesPerLambdaForDuration", () => {
  test("spreads a short video across the concurrency cap", () => {
    expect(framesPerLambdaForDuration(300)).toBe(38)
    expect(chunkCountForDuration(300)).toBe(DEFAULT_RENDER_CONCURRENCY)
    expect(lambdasInvokedForDuration(300)).toBe(DEFAULT_RENDER_CONCURRENCY + 1)
  })

  test("never launches more renderer Lambdas than the cap", () => {
    expect(framesPerLambdaForDuration(36_000)).toBe(4_500)
    expect(chunkCountForDuration(36_000)).toBe(DEFAULT_RENDER_CONCURRENCY)
    expect(lambdasInvokedForDuration(36_000)).toBe(
      DEFAULT_RENDER_CONCURRENCY + 1,
    )
  })

  test("uses fewer Lambdas when the video is shorter than one chunk per worker", () => {
    expect(framesPerLambdaForDuration(12)).toBe(5)
    expect(chunkCountForDuration(12)).toBe(3)
  })

  test("honors a higher concurrency cap", () => {
    expect(framesPerLambdaForDuration(36_000, 200)).toBe(180)
    expect(chunkCountForDuration(36_000, 200)).toBe(200)
    expect(lambdasInvokedForDuration(36_000, 200)).toBe(201)
  })
})

describe("estimatedLambdaDurationMs", () => {
  test("charges 400ms per frame at 1080p", () => {
    expect(resolutionScale(1920, 1080)).toBe(1)
    expect(estimatedLambdaDurationMs(300, 1920, 1080)).toBe(
      300 * MS_PER_FRAME_AT_1080P,
    )
  })

  test("treats portrait 1080p the same as landscape", () => {
    expect(estimatedLambdaDurationMs(300, 1080, 1920)).toBe(
      estimatedLambdaDurationMs(300, 1920, 1080),
    )
  })

  test("scales 4K to four times the 1080p duration", () => {
    expect(resolutionScale(3840, 2160)).toBe(4)
    expect(estimatedLambdaDurationMs(300, 3840, 2160)).toBe(
      300 * MS_PER_FRAME_AT_1080P * 4,
    )
  })

  test("floors outputs smaller than 1080p at half the 1080p rate", () => {
    expect(resolutionScale(1280, 720)).toBe(0.5)
    expect(estimatedLambdaDurationMs(300, 1280, 720)).toBe(
      300 * MS_PER_FRAME_AT_1080P * 0.5,
    )
  })
})

describe("lambdaUsdToCredits", () => {
  test("reserves overhead and overbooking on the estimate", () => {
    // 1.00 * 1.30 = 1.30 → 434 credits, * 1.15 → 500
    expect(lambdaUsdToCredits(1, { overbook: true })).toBe(500n)
  })

  test("settles overhead without overbooking", () => {
    expect(lambdaUsdToCredits(1, { overbook: false })).toBe(434n)
  })

  test("charges at least one credit", () => {
    expect(lambdaUsdToCredits(0, { overbook: false })).toBe(1n)
  })
})
