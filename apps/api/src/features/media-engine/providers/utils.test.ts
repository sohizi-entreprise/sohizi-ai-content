import { describe, expect, it } from "bun:test"
import { applyVendorParameterMapping } from "./utils"

const seedanceMappings = [
  {
    parameter: "aspect_ratio",
    type: "string",
    vendorParameter: "aspect_ratio",
    optionValue: "16:9",
    vendorOption: "16:9",
  },
  {
    parameter: "resolution",
    type: "string",
    vendorParameter: "resolution",
    optionValue: "480p",
    vendorOption: "480p",
  },
  {
    parameter: "duration",
    type: "number",
    vendorParameter: "duration",
    optionValue: null,
    vendorOption: null,
  },
  {
    parameter: "generate_audio",
    type: "boolean",
    vendorParameter: "generate_audio",
    optionValue: null,
    vendorOption: null,
  },
]

describe("applyVendorParameterMapping", () => {
  it("keeps option values on their parameter keys and sends duration as a number", () => {
    const mapped = applyVendorParameterMapping(
      {
        prompt: "make those 2 characters fight",
        aspect_ratio: "16:9",
        resolution: "480p",
        duration: "5",
        generate_audio: true,
        reference_images: ["https://example.com/a.png"],
        reference_videos: [],
        reference_audios: [],
      },
      seedanceMappings,
    )

    expect(mapped).toEqual({
      prompt: "make those 2 characters fight",
      aspect_ratio: "16:9",
      resolution: "480p",
      duration: 5,
      generate_audio: true,
      reference_images: ["https://example.com/a.png"],
      reference_videos: [],
      reference_audios: [],
    })
    expect(mapped).not.toHaveProperty("16:9")
    expect(mapped).not.toHaveProperty("480p")
  })

  it("renames a parameter and substitutes a distinct vendor option value", () => {
    const mapped = applyVendorParameterMapping(
      { generate_audio: true, aspect_ratio: "16:9" },
      [
        {
          parameter: "generate_audio",
          type: "boolean",
          vendorParameter: "sound",
          optionValue: null,
          vendorOption: null,
        },
        {
          parameter: "aspect_ratio",
          type: "string",
          vendorParameter: "size",
          optionValue: "16:9",
          vendorOption: "widescreen",
        },
      ],
    )

    expect(mapped).toEqual({
      sound: true,
      size: "widescreen",
    })
  })

  it("renames speech prompt to text", () => {
    const mapped = applyVendorParameterMapping(
      {
        prompt: "the time will come",
        voice: "Schedar",
        style_instructions: "slow pacing",
      },
      [
        {
          parameter: "prompt",
          type: "string",
          vendorParameter: "text",
          optionValue: null,
          vendorOption: null,
        },
      ],
    )

    expect(mapped).toEqual({
      text: "the time will come",
      voice: "Schedar",
      style_instructions: "slow pacing",
    })
  })

  it("renames ElevenLabs voice to voice_id", () => {
    const mapped = applyVendorParameterMapping({ voice: "Alicia" }, [
      {
        parameter: "voice",
        type: "string",
        vendorParameter: "voice_id",
        optionValue: null,
        vendorOption: null,
      },
    ])

    expect(mapped).toEqual({ voice_id: "Alicia" })
  })
})
