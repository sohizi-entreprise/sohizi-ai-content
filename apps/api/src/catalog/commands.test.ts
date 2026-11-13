import { describe, expect, it } from "bun:test"
import { SYSTEM_LEVEL_FILES } from "@/features/ai/agent/constants/system-files"
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
      "brainstorm",
      "remix",
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

  it("instructs document-producing commands to use /system/syntax/document", async () => {
    resetCommandCache()
    const commands = await getCommands()
    const plan = commands.find((command) => command.id === "plan")
    const script = commands.find((command) => command.id === "script")
    const brainstorm = commands.find((command) => command.id === "brainstorm")
    const remix = commands.find((command) => command.id === "remix")

    expect(plan?.promptModifier).toContain("/system/skills/generate-plan")
    expect(
      SYSTEM_LEVEL_FILES["/system/skills/generate-plan"].content,
    ).toContain("/system/syntax/document")
    expect(script?.promptModifier).toContain("/system/syntax/document")
    expect(brainstorm?.promptModifier).toContain("/system/syntax/document")
    expect(remix?.promptModifier).toContain("/system/syntax/document")
  })
})
