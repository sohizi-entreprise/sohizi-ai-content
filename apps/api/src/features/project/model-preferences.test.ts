import { describe, expect, it } from "bun:test"
import { loadPreferences } from "@/catalog/preferences"
import {
  buildModelPreferencesPrompt,
  computePreferenceCostAndEstimate,
  mergePreferenceRows,
} from "./model-preferences"

describe("model-preferences", () => {
  it("loads the seven catalog preferences starting with leading-agent", async () => {
    const preferences = await loadPreferences()
    expect(preferences.map((item) => item.key)).toEqual([
      "leading-agent",
      "text-to-image",
      "image-to-image",
      "text-to-video",
      "image-to-video",
      "text-to-speech",
      "music-generation",
    ])
    expect(preferences[0]?.modelId).toBe("anthropic/claude-sonnet-5-5")
    expect(preferences[0]?.parameters).toEqual({ reasoning_effort: "medium" })
    expect(preferences[1]?.modelId).toBe(
      "openai/gpt-image-2.5-sunburst/text-to-image",
    )
    expect(preferences[2]?.modelId).toBe("openai/gpt-image-2.5-sunburst/edit")
  })

  it("includes reasoning_effort for leading-agent when supported and skips credit estimation", () => {
    const withoutReasoning = computePreferenceCostAndEstimate(
      "leading-agent",
      {
        id: "anthropic/claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        pricing: { unit: "per_1m_tokens", input: 1, output: 5 },
      },
      [],
      {},
    )
    expect(withoutReasoning).toEqual({
      parameters: {},
      costParameters: [],
      estimate: null,
    })

    const withReasoning = computePreferenceCostAndEstimate(
      "leading-agent",
      {
        id: "anthropic/claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        pricing: { unit: "per_1m_tokens", input: 2, output: 10 },
      },
      [
        {
          key: "reasoning_effort",
          label: "Reasoning Effort",
          defaultValue: "high",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
        },
      ],
      { reasoning_effort: "medium" },
    )
    expect(withReasoning).toEqual({
      parameters: { reasoning_effort: "medium" },
      costParameters: [
        {
          key: "reasoning_effort",
          label: "Reasoning",
          defaultValue: "high",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
        },
      ],
      estimate: null,
    })
  })

  it("computes fixed credits and cost parameters for parameter_table image models", () => {
    const result = computePreferenceCostAndEstimate(
      "text-to-image",
      {
        id: "openai/gpt-image-2.5-sunburst/text-to-image",
        name: "GPT Image 2.5 Sunburst",
        pricing: {
          unit: "parameter_table",
          rate: [
            { when: { quality: "low", resolution: "1k" }, usd: 0.01 },
            { when: { quality: "medium", resolution: "1k" }, usd: 0.024 },
            { when: { quality: "medium", resolution: "2k" }, usd: 0.04 },
          ],
        },
      },
      [
        {
          key: "quality",
          label: "Quality",
          defaultValue: "medium",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
          ],
        },
        {
          key: "resolution",
          label: "Resolution",
          defaultValue: "1k",
          options: [
            { value: "1k", label: "1K" },
            { value: "2k", label: "2K" },
          ],
        },
      ],
      { quality: "medium", resolution: "1k" },
    )

    expect(result.costParameters.map((item) => item.key)).toEqual([
      "quality",
      "resolution",
    ])
    expect(result.parameters).toEqual({ quality: "medium", resolution: "1k" })
    expect(result.estimate).toEqual({
      kind: "fixed",
      credits: 9,
      unitLabel: "credits",
    })
  })

  it("computes a duration credit range for video models without exposing duration as an input", () => {
    const result = computePreferenceCostAndEstimate(
      "text-to-video",
      {
        id: "bytedance/seedance-2.0-fast/text-to-video",
        name: "Seedance 2.0 Fast",
        pricing: {
          unit: "parameter_table",
          rate: [
            { when: { duration: 4, resolution: "720p" }, usd: 0.8 },
            { when: { duration: 15, resolution: "720p" }, usd: 3 },
            { when: { duration: 4, resolution: "1080p" }, usd: 2 },
            { when: { duration: 15, resolution: "1080p" }, usd: 7.5 },
          ],
        },
      },
      [
        {
          key: "duration",
          label: "Duration",
          defaultValue: "5",
          options: [],
        },
        {
          key: "resolution",
          label: "Resolution",
          defaultValue: "720p",
          options: [
            { value: "720p", label: "720p" },
            { value: "1080p", label: "1080p" },
          ],
        },
      ],
      { resolution: "720p" },
    )

    expect(result.costParameters.map((item) => item.key)).toEqual([
      "resolution",
    ])
    expect(result.parameters).toEqual({ resolution: "720p" })
    expect(result.estimate).toEqual({
      kind: "range",
      minCredits: 307,
      maxCredits: 1150,
      unitLabel: "credits (depending on duration)",
    })
  })

  it("merges system defaults when no project rows exist and uses project rows once saved", async () => {
    const definitions = await loadPreferences()
    const systemMerged = mergePreferenceRows(definitions, [], [])
    expect(systemMerged.every((row) => row.type === "system_default")).toBe(
      true,
    )

    const projectMerged = mergePreferenceRows(
      definitions,
      [],
      [
        {
          key: "text-to-image",
          modelId: "x-ai/grok-imagine-image-v2.0/text-to-image",
          parameters: { quality: "medium", resolution: "2k" },
        },
      ],
    )
    const imageRow = projectMerged.find((row) => row.key === "text-to-image")
    expect(imageRow?.type).toBe("project")
    expect(imageRow?.modelId).toBe("x-ai/grok-imagine-image-v2.0/text-to-image")
  })

  it("builds the <project-model-preferences> system prompt block", async () => {
    const definitions = await loadPreferences()
    const prompt = buildModelPreferencesPrompt(definitions)

    expect(prompt).toContain("<project-model-preferences>")
    expect(prompt).toContain("openai/gpt-image-2.5-sunburst/text-to-image")
    expect(prompt).toContain("bytedance/seedance-2.0-fast/text-to-video")
    expect(prompt).toContain("You are not restricted to these models")
    expect(prompt).not.toContain("anthropic/claude-sonnet-5-5")
  })
})
