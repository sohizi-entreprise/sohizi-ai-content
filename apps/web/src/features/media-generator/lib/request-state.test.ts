import { describe, expect, it } from "vitest"
import { getGenerationDetails, humanizeSettingKey } from "./request-state"

describe("humanizeSettingKey", () => {
  it("splits camelCase and title-cases the first letter", () => {
    expect(humanizeSettingKey("aspectRatio")).toBe("Aspect Ratio")
    expect(humanizeSettingKey("runMode")).toBe("Run Mode")
  })

  it("replaces underscores and hyphens with spaces", () => {
    expect(humanizeSettingKey("camera_angle")).toBe("Camera angle")
    expect(humanizeSettingKey("color-palette")).toBe("Color palette")
  })
})

describe("getGenerationDetails", () => {
  it("returns null when no request was stored", () => {
    expect(getGenerationDetails(null)).toBeNull()
  })

  it("shapes prompt, labeled meta, parameters, and references", () => {
    const details = getGenerationDetails({
      model: "flux-pro",
      prompt: "cinematic aerial of a forest",
      runMode: "direct",
      settings: {
        aspectRatio: "16:9",
        resolution: "1080p",
        references: "[]",
      },
      context: {
        generationType: "image",
        subtype: "from-text",
        referencedFiles: [
          { url: "https://cdn.example.com/ref.png", type: "image" },
        ],
      },
    })

    expect(details).not.toBeNull()
    expect(details?.prompt).toBe("cinematic aerial of a forest")
    expect(details?.meta).toEqual([
      { label: "Model", value: "flux-pro" },
      { label: "Type", value: "Image" },
      { label: "Mode", value: "From text" },
      { label: "Run mode", value: "Direct" },
    ])
    expect(details?.parameters).toEqual([
      { label: "Aspect Ratio", value: "16:9" },
      { label: "Resolution", value: "1080p" },
    ])
    expect(details?.references).toEqual([
      {
        label: "Reference 1",
        url: "https://cdn.example.com/ref.png",
        type: "image",
      },
    ])
  })

  it("moves image and video fields out of settings into references", () => {
    const details = getGenerationDetails({
      model: "kling",
      prompt: "extend the shot",
      runMode: "direct",
      settings: {
        aspectRatio: "16:9",
        startImage: "https://cdn.example.com/start.webp",
        video: "https://cdn.example.com/clip.mp4",
        references: JSON.stringify([
          { url: "https://cdn.example.com/ref.jpg", type: "image" },
        ]),
      },
      context: {
        generationType: "video",
        subtype: "extend",
      },
    })

    expect(details?.parameters).toEqual([
      { label: "Aspect Ratio", value: "16:9" },
    ])
    expect(details?.references).toEqual([
      {
        label: "Start Image",
        url: "https://cdn.example.com/start.webp",
        type: "image",
      },
      {
        label: "Video",
        url: "https://cdn.example.com/clip.mp4",
        type: "video",
      },
      {
        label: "References",
        url: "https://cdn.example.com/ref.jpg",
        type: "image",
      },
    ])
  })

  it("labels agent run mode and voice", () => {
    const details = getGenerationDetails({
      prompt: "say hello",
      runMode: "agent",
      context: {
        generationType: "audio",
        subtype: "tts",
        voice: "Aoede",
      },
    })

    expect(details?.meta).toEqual(
      expect.arrayContaining([
        { label: "Type", value: "Audio" },
        { label: "Mode", value: "Text to speech" },
        { label: "Run mode", value: "Agent" },
        { label: "Voice", value: "Aoede" },
      ]),
    )
  })
})
