import { describe, expect, it } from "bun:test"
import {
  buildProjectBriefContent,
  filterPresets,
  getPresets,
  resetPresetCache,
  toPublicPresets,
} from "./presets"

describe("presets", () => {
  it("caches nine project presets and filters by generation target", async () => {
    resetPresetCache()
    const first = await getPresets()
    const second = await getPresets()

    expect(first).toHaveLength(9)
    expect(second).toBe(first)
    expect(first.map((preset) => preset.key)).toEqual([
      "format",
      "genre",
      "tone",
      "targetAudience",
      "primaryPlatform",
      "outlineStructure",
      "narrativeStyle",
      "videoAspectRatio",
      "characterStyle",
    ])
    expect(filterPresets(first, "project")).toHaveLength(9)
    expect(filterPresets(first, "image")).toHaveLength(0)
    expect(filterPresets(first)).toBe(first)
  })

  it("hides prompt modifiers from the public payload", async () => {
    const [genre] = toPublicPresets(
      filterPresets(await getPresets(), "project"),
    ).filter((preset) => preset.key === "genre")

    expect(genre?.options[0]).toEqual({
      label: "Drama",
      value: "drama",
      illustration: {
        url: "https://storage.googleapis.com/sohizi-content/genres/drama.avif",
        type: "image",
      },
    })
    expect(genre?.options[0]).not.toHaveProperty("promptModifier")
  })

  it("resolves selected values to prompt modifiers", async () => {
    const presets = await getPresets()
    const brief = buildProjectBriefContent(presets, {
      format: "storytime",
      genre: { label: "Drama", value: "drama" },
      durationMin: "< 2",
      tone: null,
      missing: { label: "Nope", value: "nope" },
    })

    expect(brief).toContain("# Project Brief")
    expect(brief).toContain("- **Format**: Tell it as a story.")
    expect(brief).toContain("- **Genre**: Tell the story as drama.")
    expect(brief).not.toContain("Tone")
    expect(brief).not.toContain("nope")
  })

  it("resolves preset selections by id", async () => {
    const presets = await getPresets()
    const format = presets.find((preset) => preset.key === "format")
    const brief = buildProjectBriefContent(presets, {
      presets: [{ id: format?.id ?? "", value: "explainer" }],
      commandId: "plan",
      modelId: null,
    })

    expect(brief).toContain("- **Format**: Explain one idea.")
    expect(brief).not.toContain("Genre")
  })
})
