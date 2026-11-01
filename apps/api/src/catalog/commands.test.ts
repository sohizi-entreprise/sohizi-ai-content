import { describe, expect, it } from "bun:test"
import {
  getCommands,
  resetCommandCache,
  resolveCatalogCommands,
  toPublicCommands,
} from "./commands"

describe("commands", () => {
  it("caches the project commands", async () => {
    resetCommandCache()
    const first = await getCommands()
    const second = await getCommands()

    expect(first.map((command) => command.id)).toEqual([
      "plan",
      "script",
      "storyboard",
      "end-to-end",
    ])
    expect(second).toBe(first)
  })

  it("hides prompt modifiers from the public payload", async () => {
    const [plan] = toPublicCommands(await getCommands())

    expect(plan).toEqual({
      id: "plan",
      name: "Plan",
    })
    expect(plan).not.toHaveProperty("promptModifier")
  })

  it("resolves catalog commands by id or name without duplicates", async () => {
    const commands = await getCommands()
    const resolved = resolveCatalogCommands(commands, [
      "plan",
      "Storyboard",
      "plan",
      "unknown",
    ])

    expect(resolved.map((command) => command.id)).toEqual([
      "plan",
      "storyboard",
    ])
  })
})
