import { MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { describe, expect, it } from "vitest"
import { storyboardSchemaExtensions } from "./storyboard-nodes"
import {
  DEFAULT_STORYBOARD_SETTINGS,
  ensureStoryboardFrontMatter,
  matchFrontMatterBlock,
  parseFrontMatter,
  parseSceneBlock,
  serializeFrontMatter,
  serializeScene,
  serializeShot,
} from "./storyboard-markdown"

type JsonNode = {
  type?: string
  attrs?: Record<string, unknown>
  content?: Array<JsonNode>
  text?: string
}

const manager = new MarkdownManager({
  // `document: false` lets our custom StoryboardDoc top node win while keeping
  // the Text node StarterKit provides for inline content.
  extensions: [
    StarterKit.configure({ document: false, horizontalRule: false }),
    ...storyboardSchemaExtensions,
  ],
  markedOptions: { gfm: true },
})

const FRONT_MATTER = `---
aspectRatio: "16:9"
visualStyle: "Gritty neo-noir, practical light, wet streets."
colorPalette:
  - "#1a1a1a"
  - "#c4a574"
temporalContext: "Present day, late autumn"
---`

const SCENE = `:::scene
id: scene-1
title: Arrival
description: A detective enters an abandoned warehouse.
environment: Abandoned warehouse on the docks, night.
lighting: One practical bulb overhead, hard shadows.

:::shot
id: shot-1
number: 1
shotType: Wide Shot
image: /images/shot-1.jpg
action: Wide establishing shot of the warehouse.
camera:
  angle: low angle
  movement: slow push in
:::

:::shot
id: shot-2
number: 2
image: /images/shot-2.jpg
action: The detective opens the door.
dialogue:
  - speaker: DETECTIVE
    text: Hello?
:::

:::shot
id: shot-3
number: 3
action: Close-up of a footprint.
narration: Someone was here recently.
:::
:::`

const SAMPLE = `${FRONT_MATTER}\n\n${SCENE}`

describe("storyboard front matter", () => {
  it("parses world-bible fields", () => {
    expect(parseFrontMatter(FRONT_MATTER)).toEqual({
      aspectRatio: "16:9",
      visualStyle: "Gritty neo-noir, practical light, wet streets.",
      colorPalette: ["#1a1a1a", "#c4a574"],
      temporalContext: "Present day, late autumn",
    })
  })

  it("falls back to 16:9 for unknown aspect ratios", () => {
    expect(
      parseFrontMatter('---\naspectRatio: "3:2"\nvisualStyle: ""\n---'),
    ).toMatchObject({ aspectRatio: "16:9" })
  })

  it("is stable across serialize -> parse", () => {
    const settings = parseFrontMatter(FRONT_MATTER)
    expect(parseFrontMatter(serializeFrontMatter(settings))).toEqual(settings)
  })

  it("prepends default front matter when it is missing", () => {
    const ensured = ensureStoryboardFrontMatter(SCENE)
    const raw = matchFrontMatterBlock(ensured)
    expect(raw).toBeDefined()
    expect(parseFrontMatter(raw ?? "")).toEqual(DEFAULT_STORYBOARD_SETTINGS)
    expect(ensured).toContain(":::scene")
  })
})

describe("storyboard scene parsing", () => {
  it("parses scene metadata and nested shots", () => {
    const scene = parseSceneBlock(SCENE)
    expect(scene.id).toBe("scene-1")
    expect(scene.title).toBe("Arrival")
    expect(scene.description).toBe("A detective enters an abandoned warehouse.")
    expect(scene.environment).toBe("Abandoned warehouse on the docks, night.")
    expect(scene.lighting).toBe("One practical bulb overhead, hard shadows.")
    expect(scene.shots).toHaveLength(3)
    expect(scene.shots[0]).toMatchObject({
      id: "shot-1",
      number: 1,
      shotType: "Wide Shot",
      image: "/images/shot-1.jpg",
      action: "Wide establishing shot of the warehouse.",
      camera: { angle: "low angle", movement: "slow push in" },
    })
    expect(scene.shots[1].dialogue).toEqual([
      { speaker: "DETECTIVE", text: "Hello?" },
    ])
    expect(scene.shots[2]).toMatchObject({
      narration: "Someone was here recently.",
    })
    expect(scene.shots[2].dialogue).toBeUndefined()
    expect(scene.shots[2].camera).toBeUndefined()
  })

  it("defaults missing environment and lighting to empty strings", () => {
    const scene = parseSceneBlock(`:::scene
id: scene-1
title: Arrival
description: A detective enters.

:::
`)
    expect(scene.environment).toBe("")
    expect(scene.lighting).toBe("")
  })

  it("is stable across serialize -> parse", () => {
    const scene = parseSceneBlock(SCENE)
    const reparsed = parseSceneBlock(serializeScene(scene))
    expect(reparsed).toEqual(scene)
  })

  it("omits camera when both angle and movement are empty", () => {
    const serialized = serializeShot({
      id: "shot-1",
      action: "Wide.",
      camera: { angle: "", movement: "" },
    })
    expect(serialized).not.toContain("camera:")
    expect(
      parseSceneBlock(
        `:::scene\nid: s\ntitle:\ndescription:\n\n${serialized}\n:::`,
      ).shots[0].camera,
    ).toBeUndefined()
  })
})

describe("storyboard markdown round-trip via MarkdownManager", () => {
  it("parses into the storyboard node tree", () => {
    const doc = manager.parse(SAMPLE) as unknown as JsonNode
    expect(doc.type).toBe("doc")
    const meta = doc.content?.[0]
    expect(meta?.type).toBe("storyboardMeta")
    expect(meta?.attrs).toMatchObject({
      aspectRatio: "16:9",
      visualStyle: "Gritty neo-noir, practical light, wet streets.",
      colorPalette: ["#1a1a1a", "#c4a574"],
      temporalContext: "Present day, late autumn",
    })

    const scene = doc.content?.[1]
    expect(scene?.type).toBe("storyboardScene")
    expect(scene?.attrs?.sceneId).toBe("scene-1")

    const [title, action, environment, lighting, grid] = scene?.content ?? []
    expect(title.type).toBe("sceneTitle")
    expect(title.content?.[0]?.text).toBe("Arrival")
    expect(action.type).toBe("sceneAction")
    expect(environment.type).toBe("sceneEnvironment")
    expect(environment.content?.[0]?.text).toBe(
      "Abandoned warehouse on the docks, night.",
    )
    expect(lighting.type).toBe("sceneLighting")
    expect(grid.type).toBe("shotGrid")
    expect(grid.content).toHaveLength(3)
    expect(grid.content?.[0]?.attrs).toMatchObject({
      shotType: "Wide Shot",
      cameraAngle: "low angle",
      cameraMovement: "slow push in",
    })
    expect(grid.content?.[1]?.attrs?.dialogue).toEqual([
      { speaker: "DETECTIVE", text: "Hello?" },
    ])
  })

  it("serializes back to equivalent markdown", () => {
    const doc = manager.parse(SAMPLE)
    const serialized = manager.serialize(doc)
    const reparsed = manager.parse(serialized)
    expect(reparsed).toEqual(doc)
  })

  it("handles multiple scenes", () => {
    const twoScenes = `${SAMPLE}\n\n:::scene\nid: scene-2\ntitle: Departure\ndescription: The detective leaves.\nenvironment:\nlighting:\n\n:::shot\nid: shot-4\nnumber: 1\naction: Exterior wide.\n:::\n:::`
    const doc = manager.parse(twoScenes) as unknown as JsonNode
    expect(doc.content).toHaveLength(3)
    expect(doc.content?.[2]?.attrs?.sceneId).toBe("scene-2")
  })
})
