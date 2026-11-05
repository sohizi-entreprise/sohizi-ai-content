import { describe, expect, it } from "vitest"
import {
  GREETINGS,
  SUGGESTIONS,
  getFirstName,
} from "../constants/empty-state-content"
import { buildCommandPromptDoc } from "../hooks/use-fill-chat-input"
import { pickNonRepeatingIndex } from "../hooks/use-stable-random"

describe("getFirstName", () => {
  it("extracts the first token from a full name", () => {
    expect(getFirstName("Sage Lokongi")).toBe("Sage")
    expect(getFirstName("  Alice   Smith  ")).toBe("Alice")
  })

  it("returns undefined for empty or missing names", () => {
    expect(getFirstName(undefined)).toBeUndefined()
    expect(getFirstName(null)).toBeUndefined()
    expect(getFirstName("   ")).toBeUndefined()
  })
})

describe("GREETINGS and SUGGESTIONS", () => {
  it("renders every greeting with and without a first name", () => {
    for (const build of GREETINGS) {
      const withName = build("Sage")
      const withoutName = build(undefined)
      expect(withName).toContain("Sage")
      expect(withoutName).not.toContain("undefined")
      expect(withoutName.length).toBeGreaterThan(0)
    }
  })

  it("provides the 3 command suggestions (brainstorm, remix, plan)", () => {
    expect(SUGGESTIONS.map((s) => s.command.id)).toEqual([
      "brainstorm",
      "remix",
      "plan",
    ])
    for (const suggestion of SUGGESTIONS) {
      expect(suggestion.title.length).toBeGreaterThan(0)
      expect(suggestion.description.length).toBeGreaterThan(0)
      expect(suggestion.command.display.length).toBeGreaterThan(0)
    }
  })
})

describe("buildCommandPromptDoc", () => {
  it("builds a doc with a commandMention chip + prompt prefix + ':' on line 1 and an empty paragraph on line 2", () => {
    const doc = buildCommandPromptDoc(
      { id: "brainstorm", display: "Brainstorm" },
      "Brainstorm a new idea about",
    )
    expect(doc).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "commandMention",
              attrs: {
                id: "brainstorm",
                name: "brainstorm",
                display: "Brainstorm",
              },
            },
            {
              type: "text",
              text: " Brainstorm a new idea about:",
            },
          ],
        },
        {
          type: "paragraph",
        },
      ],
    })
  })
})

describe("pickNonRepeatingIndex", () => {
  it("never repeats the previous index when length > 1", () => {
    const length = 12
    for (let last = 0; last < length; last++) {
      for (const r of [0, 0.1, 0.25, 0.5, 0.75, 0.999]) {
        const next = pickNonRepeatingIndex(length, last, () => r)
        expect(next).toBeGreaterThanOrEqual(0)
        expect(next).toBeLessThan(length)
        expect(next).not.toBe(last)
      }
    }
  })

  it("handles single-item and no-history cases", () => {
    expect(pickNonRepeatingIndex(1, 0, () => 0.5)).toBe(0)
    expect(pickNonRepeatingIndex(5, null, () => 0.4)).toBe(2)
  })
})
