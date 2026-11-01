import { describe, expect, it } from "vitest"
import { contextWindowPercentage } from "./types"

describe("contextWindowPercentage", () => {
  const model = { id: "anthropic/claude-opus-4-7", contextWindow: 1_000_000 }

  it("uses the latest model step rather than cumulative conversation usage", () => {
    expect(
      contextWindowPercentage({ input: 102_000, modelId: model.id }, model),
    ).toBe(10.2)
  })

  it("does not claim a measurement for legacy data or another model", () => {
    expect(contextWindowPercentage(null, model)).toBeNull()
    expect(
      contextWindowPercentage(
        { input: 102_000, modelId: "openai/gpt-6-sol" },
        model,
      ),
    ).toBeNull()
  })
})
