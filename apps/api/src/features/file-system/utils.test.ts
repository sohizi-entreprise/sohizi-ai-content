import { describe, expect, it } from "bun:test"
import { fileNodePathCandidates, normalizeFileNodeName } from "./utils"

describe("normalizeFileNodeName", () => {
  it("keeps the final extension in a single ltree label", () => {
    expect(normalizeFileNodeName("Photo.PNG", false)).toBe("photo_png")
    expect(normalizeFileNodeName("report.final.pdf", false)).toBe(
      "report-final_pdf",
    )
    expect(normalizeFileNodeName("archive.tar.gz", false)).toBe(
      "archive-tar_gz",
    )
  })

  it("preserves the current naming rule without an extension", () => {
    expect(normalizeFileNodeName("Read Me", false)).toBe("read-me")
    expect(normalizeFileNodeName(".env", false)).toBe("-env")
    expect(normalizeFileNodeName("photos.final", true)).toBe("photos-final")
  })

  it("is stable when applied more than once", () => {
    const name = normalizeFileNodeName("report.final.pdf", false)
    expect(normalizeFileNodeName(name, false)).toBe(name)
  })
})

it("looks up exact, new, then legacy paths", () => {
  expect(fileNodePathCandidates(["root", "report.final.pdf"])).toEqual([
    "root.report.final.pdf",
    "root.report-final_pdf",
    "root.report-final-pdf",
  ])
})
