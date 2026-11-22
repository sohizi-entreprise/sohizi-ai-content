import { describe, expect, it } from "bun:test"
import {
  buildProjectBriefContent,
  filterPresets,
  getPresets,
  loadPresets,
  resetPresetCache,
  toPublicPresets,
} from "./presets"

describe("presets", () => {
  it("caches nine project presets and filters by generation target", async () => {
    resetPresetCache()
    const first = await getPresets(loadPresets)
    const second = await getPresets(loadPresets)

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
      filterPresets(await getPresets(loadPresets), "project"),
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

  it("resolves selected values to custom properties and attributes markdown blocks", async () => {
    const presets = await getPresets(loadPresets)
    const brief = buildProjectBriefContent(presets, {
      format: "storytime",
      genre: { label: "Drama", value: "drama" },
      durationMin: "< 2",
      tone: null,
      missing: { label: "Nope", value: "nope" },
    })

    expect(brief).toContain("# Project Brief")
    expect(brief).toContain(
      ":::properties\ntitle: Production Specifications\nlayout: grid",
    )
    expect(brief).toContain("- Format: Storytime")
    expect(brief).toContain("- Genre: Drama")
    expect(brief).toContain(":::attributes\ntitle: Creative Direction")
    expect(brief).toContain("- Format:\n  Tell it as a story.")
    expect(brief).toContain("- Genre:\n  Tell the story as drama.")
    expect(brief).not.toContain("Tone")
    expect(brief).not.toContain("nope")
  })

  it("resolves preset selections by id and places user brief text after settings", async () => {
    const presets = await getPresets(loadPresets)
    const format = presets.find((preset) => preset.key === "format")
    const brief = buildProjectBriefContent(
      presets,
      {
        presets: [{ id: format?.id ?? "", value: "explainer" }],
        commandId: "plan",
        modelId: null,
      },
      "A 60-second breakdown of how quantum tunneling works in everyday flash memory.",
    )

    expect(brief).toContain("- Format: Explainer")
    expect(brief).toContain("- Format:\n  Explain one idea.")
    expect(brief).toEndWith(
      ":::\n\nA 60-second breakdown of how quantum tunneling works in everyday flash memory.\n",
    )
    expect(brief).not.toContain("Genre")
  })

  it("formats brief with text only when no presets are selected", async () => {
    const presets = await getPresets(loadPresets)
    const brief = buildProjectBriefContent(
      presets,
      [],
      "A short documentary about urban beekeeping.",
    )

    expect(brief).toBe(
      "# Project Brief\n\nA short documentary about urban beekeeping.\n",
    )
  })
})
