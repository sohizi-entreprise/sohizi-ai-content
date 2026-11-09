import { describe, expect, it } from "bun:test"
import { DEFAULT_STORYBOARD_CONTENT } from "./constants"
import { validateStoryboardSyntax } from "./storyboard-syntax"

const VALID = `---
aspectRatio: "16:9"
visualStyle: "Gritty neo-noir, practical light, wet streets."
colorPalette:
  - "#1a1a1a"
  - "#c4a574"
temporalContext: "Present day, late autumn"
---

:::scene
id: scene-1
title: Arrival
action: A detective enters an abandoned warehouse.
environment: Abandoned warehouse on the docks, night.
lighting: One practical bulb overhead, hard shadows.

:::shot
id: shot-1
number: 1
shotType: Wide Shot
image: https://example.com/shot-1.jpg
action: Wide establishing shot of the warehouse.
composition: Warehouse centered in upper two-thirds; dock pilings in foreground.
duration: 3s
purpose: Establish scale and isolation before entry.
transition: Cut on door movement
camera:
  angle: low angle
  movement: slow push in
:::

:::shot
id: shot-2
number: 2
action: The detective opens the door.
dialogue:
  - speaker: DETECTIVE
    text: Hello?
narration: Wind moves through the rafters.
:::
:::
`

describe("validateStoryboardSyntax", () => {
  it("accepts the starter storyboard, including empty keys", () => {
    expect(validateStoryboardSyntax(DEFAULT_STORYBOARD_CONTENT)).toEqual({
      ok: true,
    })
  })

  it("accepts a scene with shots, dialogue, and camera", () => {
    expect(validateStoryboardSyntax(VALID)).toEqual({ ok: true })
  })

  it("accepts an empty shot when the required keys are present", () => {
    const content = `---
aspectRatio: ""
visualStyle:
colorPalette:
temporalContext: ""
---

:::scene
id:
title:
action:
environment:
lighting:

:::shot
id:
number:
action:
:::
:::
`
    expect(validateStoryboardSyntax(content)).toEqual({ ok: true })
  })

  it("rejects ordinary markdown and tells the agent to load the syntax", () => {
    const result = validateStoryboardSyntax("# Arrival\n\nA detective enters.")
    expect(result.ok).toBe(false)
    expect(result.error).toContain("Storyboard syntax is invalid:")
    expect(result.error).toContain('fileType "storyboard"')
    expect(result.error).toContain("exactly `---`")
  })

  it("reports a missing scene key", () => {
    const content = `---
aspectRatio: "16:9"
visualStyle: ""
colorPalette:
temporalContext: ""
---

:::scene
id: scene-1
title: Arrival
action: A detective enters.
environment: Warehouse
:::
`
    const result = validateStoryboardSyntax(content)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("missing `lighting`")
  })

  it("reports an unclosed shot and a bad fence", () => {
    const content = `---
aspectRatio: "16:9"
visualStyle: ""
colorPalette:
temporalContext: ""
---

:::scene
id: scene-1
title:
action:
environment:
lighting:
::: shot
id: shot-1
number: 1
action: Wide.
:::
:::
`
    const result = validateStoryboardSyntax(content)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("exactly `:::shot`")
  })

  it("reports an invalid aspect ratio, palette item, and dialogue line", () => {
    const content = `---
aspectRatio: "2:1"
visualStyle: "Night"
colorPalette:
  - red
temporalContext: ""
---

:::scene
id: scene-1
title:
action:
environment:
lighting:

:::shot
id: shot-1
number: 0
shotType: Extreme Medium
action: Wide.
dialogue:
  - speaker: DETECTIVE
:::
:::
`
    const result = validateStoryboardSyntax(content)
    expect(result.ok).toBe(false)
    expect(result.error).toContain("`aspectRatio` must be one of")
    expect(result.error).toContain("quoted hex color")
    expect(result.error).toContain("1-based integer")
    expect(result.error).toContain("`shotType` must be one of")
    expect(result.error).toContain("missing its indented `text` line")
  })
})
