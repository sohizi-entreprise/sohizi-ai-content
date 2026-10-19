import { describe, expect, it } from "bun:test"
import {
  buildCommandPrompt,
  getCommands,
  resetCommandCache,
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

  it("builds a prompt from the selected command", async () => {
    const commands = await getCommands()

    expect(buildCommandPrompt(commands, "plan")).toContain("<project-command>")
    expect(buildCommandPrompt(commands, "plan")).toContain("Plan the video")
    expect(buildCommandPrompt(commands, null)).toBe("")
    expect(buildCommandPrompt(commands, "missing")).toBe("")
  })
})
