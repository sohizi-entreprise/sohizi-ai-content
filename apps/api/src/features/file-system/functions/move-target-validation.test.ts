import { describe, expect, it } from "bun:test"
import { requiresMoveTargetValidation } from "./move-target-validation"

describe("requiresMoveTargetValidation", () => {
  it("does not treat a same-folder reorder as a folder move", () => {
    expect(requiresMoveTargetValidation("folder", "folder")).toBe(false)
    expect(requiresMoveTargetValidation(null, null)).toBe(false)
  })

  it("still validates actual moves to another parent", () => {
    expect(requiresMoveTargetValidation("folder-a", "folder-b")).toBe(true)
    expect(requiresMoveTargetValidation("folder", null)).toBe(true)
    expect(requiresMoveTargetValidation(null, "folder")).toBe(true)
  })
})
