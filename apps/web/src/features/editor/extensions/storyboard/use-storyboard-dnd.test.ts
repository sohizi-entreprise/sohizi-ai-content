import { describe, expect, it } from "vitest"
import { sceneToNode } from "./storyboard-nodes"
import { relocateShots } from "./use-storyboard-dnd"
import type { JSONContent } from "@tiptap/core"

function scene(id: string, shotIds: Array<string>): JSONContent {
  return sceneToNode({
    id,
    title: id,
    description: "",
    environment: "",
    lighting: "",
    shots: shotIds.map((shotId) => ({ id: shotId })),
  })
}

function shotIdsIn(scenes: Array<JSONContent>, sceneId: string): Array<string> {
  const target = scenes.find((node) => node.attrs?.sceneId === sceneId)
  const grid = target?.content?.find((child) => child.type === "shotGrid")
  return (grid?.content ?? []).map((shot) => String(shot.attrs?.shotId ?? ""))
}

describe("relocateShots", () => {
  it("moves a shot down by taking the later shot's slot", () => {
    const scenes = [scene("scene-1", ["shot-1", "shot-2"])]

    expect(relocateShots(scenes, "shot-1", "scene-1", "shot-2")).toBe(true)
    expect(shotIdsIn(scenes, "scene-1")).toEqual(["shot-2", "shot-1"])
  })

  it("moves a shot back up after a downward swap", () => {
    const scenes = [scene("scene-1", ["shot-2", "shot-1"])]

    expect(relocateShots(scenes, "shot-2", "scene-1", "shot-1")).toBe(true)
    expect(shotIdsIn(scenes, "scene-1")).toEqual(["shot-1", "shot-2"])
  })

  it("inserts before the target when moving across scenes", () => {
    const scenes = [
      scene("scene-1", ["shot-1", "shot-2"]),
      scene("scene-2", ["shot-3"]),
    ]

    expect(relocateShots(scenes, "shot-2", "scene-2", "shot-3")).toBe(true)
    expect(shotIdsIn(scenes, "scene-1")).toEqual(["shot-1"])
    expect(shotIdsIn(scenes, "scene-2")).toEqual(["shot-2", "shot-3"])
  })

  it("appends when no target shot is given", () => {
    const scenes = [scene("scene-1", ["shot-1"]), scene("scene-2", ["shot-2"])]

    expect(relocateShots(scenes, "shot-1", "scene-2")).toBe(true)
    expect(shotIdsIn(scenes, "scene-1")).toEqual([])
    expect(shotIdsIn(scenes, "scene-2")).toEqual(["shot-2", "shot-1"])
  })
})
