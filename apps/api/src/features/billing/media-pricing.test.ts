import { describe, expect, test } from "bun:test"
import {
  calculateMediaProviderCost,
  resolveMediaPricingParams,
} from "./credits"

const tablePricing = {
  unit: "parameter_table" as const,
  rate: [
    { when: { quality: "medium", resolution: "1k" }, usd: 0.06 },
    { when: { quality: "high", resolution: "2k" }, usd: 0.4 },
    { when: { duration: 5, resolution: "720p" }, usd: 1.8 },
  ],
}

describe("resolveMediaPricingParams", () => {
  test("fills missing keys from catalog defaults", () => {
    expect(
      resolveMediaPricingParams(
        { prompt: "a cat" },
        [
          { key: "quality", defaultValue: "medium" },
          { key: "resolution", defaultValue: "1k" },
        ],
      ),
    ).toEqual({
      quality: "medium",
      resolution: "1k",
      prompt: "a cat",
    })
  })

  test("keeps explicit payload values over defaults", () => {
    expect(
      resolveMediaPricingParams(
        { quality: "high", resolution: "2k" },
        [
          { key: "quality", defaultValue: "medium" },
          { key: "resolution", defaultValue: "1k" },
        ],
      ),
    ).toEqual({
      quality: "high",
      resolution: "2k",
    })
  })
})

describe("calculateMediaProviderCost", () => {
  test("returns the flat catalog rate for per_inference models", () => {
    expect(
      calculateMediaProviderCost({
        name: "Lyria 3.5",
        pricing: { unit: "per_inference", rate: 0.1 },
      }),
    ).toBe(0.1)
  })

  test("matches a parameter_table row from request params", () => {
    expect(
      calculateMediaProviderCost(
        { name: "GPT Image 2", pricing: tablePricing },
        { quality: "high", resolution: "2k" },
      ),
    ).toBe(0.4)
  })

  test("matches numeric table keys when the payload value is a string", () => {
    expect(
      calculateMediaProviderCost(
        { name: "Seedance 2.5", pricing: tablePricing },
        { duration: "5", resolution: "720p" },
      ),
    ).toBe(1.8)
  })

  test("throws when no table row matches", () => {
    expect(() =>
      calculateMediaProviderCost(
        { name: "GPT Image 2", pricing: tablePricing },
        { quality: "low", resolution: "1k" },
      ),
    ).toThrow("no catalog price")
  })

  test("throws for token-priced models", () => {
    expect(() =>
      calculateMediaProviderCost({
        name: "GPT-5.4",
        pricing: { unit: "per_1m_tokens", input: 1, output: 2 },
      }),
    ).toThrow("Unsupported pricing unit for media billing")
  })
})
