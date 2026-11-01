import { describe, expect, it } from "vitest"
import {
  chooseLabelForFileTypes,
  coerceParameterSettings,
  getUploaderFileType,
} from "./parameter-assets"
import type { ModelParameterBinding } from "@/features/admin/types"

function binding(
  overrides: Partial<ModelParameterBinding> &
    Pick<ModelParameterBinding, "key" | "type">,
): ModelParameterBinding {
  return {
    parameterId: overrides.key,
    label: overrides.key,
    description: null,
    xUiComponent: overrides.type === "boolean" ? "checkbox" : null,
    required: false,
    sortOrder: 0,
    defaultValue: null,
    constraints: null,
    options: [],
    ...overrides,
  }
}

describe("coerceParameterSettings", () => {
  it("sends checkbox values as booleans", () => {
    const settings = coerceParameterSettings(
      { generate_audio: "true", prompt: "a city at night" },
      [
        binding({ key: "generate_audio", type: "boolean" }),
        binding({ key: "prompt", type: "string" }),
      ],
    )

    expect(settings.generate_audio).toBe(true)
    expect(settings.prompt).toBe("a city at night")
  })

  it("sends numeric settings as numbers", () => {
    const settings = coerceParameterSettings({ duration: "5" }, [
      binding({
        key: "duration",
        type: "number",
        xUiComponent: "slider",
      }),
    ])

    expect(settings.duration).toBe(5)
  })

  it("keeps an unchecked checkbox as false", () => {
    const settings = coerceParameterSettings({ generate_audio: "false" }, [
      binding({ key: "generate_audio", type: "boolean" }),
    ])

    expect(settings.generate_audio).toBe(false)
  })
})

describe("getUploaderFileType", () => {
  it("uses constraints.fileType when it is set", () => {
    expect(
      getUploaderFileType(
        binding({
          key: "image",
          type: "string",
          constraints: { fileType: "video" },
        }),
      ),
    ).toBe("video")
  })

  it.each([
    ["image", "image"],
    ["images", "image"],
    ["last_image", "image"],
    ["reference_images", "image"],
    ["video", "video"],
    ["reference_videos", "video"],
    ["audio", "audio"],
    ["reference_audios", "audio"],
  ] as const)("maps %s to %s", (key, expected) => {
    expect(getUploaderFileType(binding({ key, type: "string" }))).toBe(expected)
  })

  it("falls back to image for unknown keys", () => {
    expect(getUploaderFileType(binding({ key: "mask", type: "string" }))).toBe(
      "image",
    )
  })
})

describe("chooseLabelForFileTypes", () => {
  it("uses the singular type for one file", () => {
    expect(chooseLabelForFileTypes(["video"], false)).toBe("video")
  })

  it("pluralizes image and video when multiple files are allowed", () => {
    expect(chooseLabelForFileTypes(["image"], true)).toBe("images")
    expect(chooseLabelForFileTypes(["video"], true)).toBe("videos")
  })

  it("keeps audio singular", () => {
    expect(chooseLabelForFileTypes(["audio"], true)).toBe("audio")
  })

  it("falls back to files when more than one type is allowed", () => {
    expect(chooseLabelForFileTypes(["image", "video"], true)).toBe("files")
  })
})
