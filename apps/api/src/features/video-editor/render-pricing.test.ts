import { describe, expect, test } from "bun:test"
import {
  chunkCountForDuration,
  DEFAULT_RENDER_CONCURRENCY,
  framesPerLambdaForDuration,
  lambdaUsdToCredits,
  lambdasInvokedForDuration,
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
