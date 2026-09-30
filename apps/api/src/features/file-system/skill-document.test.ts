import { describe, expect, it } from "bun:test"
import {
  parseSkillDocument,
  resolveSkillFileMetadata,
  serializeSkillDocument,
} from "./skill-document"

describe("skill document frontmatter", () => {
  it("round-trips a multiline description with colons", () => {
    const skill = {
      description: "Use when writing a scene.\nKeep the tone: dry.",
      instructions: "Write the scene in present tense.",
    }

    expect(parseSkillDocument(serializeSkillDocument(skill))).toEqual(skill)
  })

  it("round-trips a --- line inside the description", () => {
    const skill = {
      description: "Before the break.\n---\nAfter the break.",
      instructions: "Do not treat the description divider as frontmatter.",
    }

    const serialized = serializeSkillDocument(skill)
    expect(serialized).toContain("\n  ---\n")
    expect(parseSkillDocument(serialized)).toEqual(skill)
  })

  it("round-trips an empty description", () => {
    const skill = {
      description: "",
      instructions: "Only instructions here.",
    }

    expect(serializeSkillDocument(skill)).toBe(
      '---\ndescription: ""\n---\nOnly instructions here.',
    )
    expect(parseSkillDocument(serializeSkillDocument(skill))).toEqual(skill)
  })

  it("parses a literal block description", () => {
    const content = `---
description: |
  Use this when writing a scene.

  Keep the tone dry.
---
Write the scene in present tense.`

    expect(parseSkillDocument(content)).toEqual({
      description: "Use this when writing a scene.\n\nKeep the tone dry.",
      instructions: "Write the scene in present tense.",
    })
  })

  it("rejects content without frontmatter", () => {
    expect(parseSkillDocument("Just instructions")).toBeNull()
    expect(parseSkillDocument("---\nno description key\n---\nbody")).toBeNull()
  })
})

describe("resolveSkillFileMetadata", () => {
  it("prefers file node metadata over the skills-row fallback", () => {
    expect(
      resolveSkillFileMetadata(
        { status: "published", visibility: "public" },
        { status: "draft", visibility: "private" },
      ),
    ).toEqual({ status: "published", visibility: "public" })
  })

  it("falls back to the skills row when metadata is missing", () => {
    expect(
      resolveSkillFileMetadata(null, {
        status: "published",
        visibility: "private",
      }),
    ).toEqual({ status: "published", visibility: "private" })
  })
})
