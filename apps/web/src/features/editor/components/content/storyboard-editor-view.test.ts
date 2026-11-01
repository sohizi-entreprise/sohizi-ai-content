// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  DEFAULT_STORYBOARD_SETTINGS,
  serializeFrontMatter,
} from "../../extensions/storyboard"
import { toStoryboardContent } from "./storyboard-editor-view"

describe("toStoryboardContent", () => {
  it("seeds world bible and an empty scene when markdown is blank", () => {
    const result = toStoryboardContent("   ")

    expect(result.contentType).toBeUndefined()
    expect(result.content).toEqual(
      expect.objectContaining({
        type: "doc",
        content: [
          expect.objectContaining({
            type: "storyboardMeta",
            attrs: expect.objectContaining({
              aspectRatio: "16:9",
            }),
          }),
          expect.objectContaining({
            type: "storyboardScene",
          }),
        ],
      }),
    )
  })

  it("prepends default front matter when the file has none", () => {
    const markdown = `:::scene
id: scene-1
title: Arrival
description:

:::
`

    expect(toStoryboardContent(markdown)).toEqual({
      content: `${serializeFrontMatter(DEFAULT_STORYBOARD_SETTINGS)}\n\n${markdown.trim()}`,
      contentType: "markdown",
    })
  })

  it("keeps existing front matter for the TipTap parser", () => {
    const markdown = `${serializeFrontMatter(DEFAULT_STORYBOARD_SETTINGS)}

:::scene
id: scene-1
title: Arrival
description:
environment:
lighting:

:::`.trim()

    expect(toStoryboardContent(markdown)).toEqual({
      content: markdown,
      contentType: "markdown",
    })
  })
})
