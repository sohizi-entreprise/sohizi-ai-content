import { describe, expect, it } from "bun:test"
import { agentRunMetadata } from "./persistence"
import type { TokenUsage } from "@/type"

const usage: TokenUsage = {
  cost: 0.05634110000000002,
  input: 141822,
  total: 144338,
  cached: 123648,
  output: 2516,
  modelId: "openai/gpt-5.1",
  reasoning: 1540,
}

describe("agentRunMetadata", () => {
  it("stores this run's usage and the vendor that fulfilled it", () => {
    expect(agentRunMetadata(usage, "vercel-gateway")).toEqual({
      usage,
      vendor: "vercel-gateway",
    })
  })

  it("omits vendor when no provider fulfilled the call", () => {
    expect(agentRunMetadata(usage, null)).toEqual({ usage })
  })

  it("returns nothing when the run generated no usage", () => {
    expect(agentRunMetadata(null, "vercel-gateway")).toBe(undefined)
  })
})
