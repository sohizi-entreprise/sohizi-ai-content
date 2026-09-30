import { describe, expect, it } from "vitest"
import {
  createMarkdownDiff,
  getMarkdownChangeHunks,
  getMarkdownChangeParts,
  RejectMergeConflictError,
  rejectPendingMarkdown,
} from "./diff-markdown"

describe("createMarkdownDiff", () => {
  it("returns an equal part when nothing changed", () => {
    const diff = createMarkdownDiff("hello", "hello")

    expect(diff.usedFallback).toBe(false)
    expect(diff.parts).toEqual([{ kind: "equal", text: "hello" }])
    expect(getMarkdownChangeParts("hello", "hello")).toEqual([])
  })

  it("lists an insertion in document order", () => {
    const parts = getMarkdownChangeParts("hello", "hello world")

    expect(parts).toEqual([
      expect.objectContaining({
        kind: "insert",
        text: " world",
      }),
    ])
    expect(parts[0]?.id).toMatch(/^insert-/)
  })

  it("lists a deletion in document order", () => {
    const parts = getMarkdownChangeParts("hello world", "hello")

    expect(parts).toEqual([
      expect.objectContaining({
        kind: "delete",
        text: " world",
      }),
    ])
  })

  it("lists a replacement as a deletion followed by an insertion", () => {
    const parts = getMarkdownChangeParts("red fox", "blue fox")

    expect(parts.map((part) => part.kind)).toEqual(["delete", "insert"])
    expect(parts[0]?.text).toContain("red")
    expect(parts[1]?.text).toContain("blue")
  })
})

describe("getMarkdownChangeHunks", () => {
  it("shows a bold wrap as the original word and the wrapped word", () => {
    expect(
      getMarkdownChangeHunks("Look, confident him", "Look, **confident** him"),
    ).toEqual([
      expect.objectContaining({
        deleted: "confident",
        inserted: "**confident**",
      }),
    ])
  })

  it("keeps distant wraps as separate word-level hunks", () => {
    const hunks = getMarkdownChangeHunks(
      "Hello world, this is a much longer sentence with more words here",
      "**Hello** world, this is a much longer sentence with more words **here**",
    )

    expect(hunks).toEqual([
      expect.objectContaining({
        deleted: "Hello",
        inserted: "**Hello**",
      }),
      expect.objectContaining({
        deleted: "here",
        inserted: "**here**",
      }),
    ])
  })

  it("groups a nearby word replacement into one hunk", () => {
    expect(
      getMarkdownChangeHunks("the red fox jumped", "the blue cat jumped"),
    ).toEqual([
      expect.objectContaining({
        deleted: "red fox",
        inserted: "blue cat",
      }),
    ])
  })
})

describe("rejectPendingMarkdown", () => {
  it("restores the original document when the user did not edit", () => {
    expect(
      rejectPendingMarkdown({
        baseContent: "alpha\n",
        proposal: "alpha\nbeta\n",
        current: "alpha\nbeta\n",
      }),
    ).toBe("alpha\n")
  })

  it("keeps unrelated manual edits when the suggestion is rejected", () => {
    const merged = rejectPendingMarkdown({
      baseContent: "title\n\nbody one\n\nfooter\n",
      proposal: "title\n\nbody one\n\nfooter changed\n",
      current: "title edited\n\nbody one\n\nfooter changed\n",
    })

    expect(merged).toBe("title edited\n\nbody one\n\nfooter\n")
  })

  it("throws when a manual edit overlaps the suggestion", () => {
    expect(() =>
      rejectPendingMarkdown({
        baseContent: "the red fox\n",
        proposal: "the blue fox\n",
        current: "the green fox\n",
      }),
    ).toThrow(RejectMergeConflictError)
  })
})
