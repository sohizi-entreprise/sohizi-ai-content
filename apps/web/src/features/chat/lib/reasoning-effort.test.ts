import { describe, expect, it } from "vitest"
import {
  reasoningEffortLabel,
  resolveReasoningEffort,
} from "./reasoning-effort"
import type { LlmModel } from "../types"

const model: LlmModel = {
  id: "openai/gpt-6-astra",
  provider: "openai",
  name: "GPT-6 Astra",
  reasoningEffort: {
    defaultValue: "medium",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
  },
}

describe("resolveReasoningEffort", () => {
  it("uses the catalog default when there is no override", () => {
    expect(resolveReasoningEffort(model, {})).toBe("medium")
  })

  it("uses the stored override for that model", () => {
    expect(
      resolveReasoningEffort(model, { "openai/gpt-6-astra": "high" }),
    ).toBe("high")
  })

  it("returns undefined when the model has no reasoning binding", () => {
    expect(
      resolveReasoningEffort(
        { id: "other", provider: "openai", name: "Other" },
        {},
      ),
    ).toBeUndefined()
  })
})

describe("reasoningEffortLabel", () => {
  it("returns the catalog label for a value", () => {
    expect(reasoningEffortLabel(model.reasoningEffort, "high")).toBe("High")
  })
})
