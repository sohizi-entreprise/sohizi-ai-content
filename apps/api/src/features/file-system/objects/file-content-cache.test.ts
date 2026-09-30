import { describe, expect, it } from "bun:test"
import { isCompatibleContentCacheType } from "./file"
import { fileFormat, fileType } from "../constants"

describe("isCompatibleContentCacheType", () => {
  it("accepts a markdown payload for markdown documents", () => {
    expect(
      isCompatibleContentCacheType(
        fileType.DOCUMENT,
        fileFormat.MARKDOWN,
        "markdown",
      ),
    ).toBe(true)
  })

  it("accepts a markdown payload for storyboard files", () => {
    expect(
      isCompatibleContentCacheType(
        fileType.STORYBOARD,
        fileFormat.MARKDOWN,
        "markdown",
      ),
    ).toBe(true)
  })

  it("accepts a markdown payload for skill files", () => {
    expect(
      isCompatibleContentCacheType(
        fileType.SKILL,
        fileFormat.MARKDOWN,
        "markdown",
      ),
    ).toBe(true)
  })

  it("rejects a skill payload for storyboard files", () => {
    expect(
      isCompatibleContentCacheType(
        fileType.STORYBOARD,
        fileFormat.MARKDOWN,
        "skill",
      ),
    ).toBe(false)
  })

  it("rejects missing type or content type", () => {
    expect(
      isCompatibleContentCacheType(null, fileFormat.MARKDOWN, "markdown"),
    ).toBe(false)
    expect(
      isCompatibleContentCacheType(
        fileType.DOCUMENT,
        fileFormat.MARKDOWN,
        undefined,
      ),
    ).toBe(false)
  })
})
