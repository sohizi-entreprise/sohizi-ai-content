import { describe, expect, it } from "bun:test"
import {
  canCreateFileTypeInFolder,
  fileTypeOptionsForFolder,
} from "./node-menu"

describe("file types allowed by folder", () => {
  it("offers skills only inside skill folders", () => {
    expect(
      fileTypeOptionsForFolder(null).map((option) => option.value),
    ).toEqual(["document", "storyboard"])
    expect(
      fileTypeOptionsForFolder("skill").map((option) => option.value),
    ).toEqual(["skill"])
    expect(canCreateFileTypeInFolder("skill", null)).toBe(false)
    expect(canCreateFileTypeInFolder("skill", "skill")).toBe(true)
  })
})
