import { describe, expect, it } from "bun:test"
import { fileFormat, fileType } from "./constants"
import {
  classifyFileKindFromAsset,
  classifyFileKindFromContentType,
  defaultFormatForType,
  isAllowedFileKind,
  isMarkdownEditable,
  migrateLegacyFormat,
  resolveCreatedFileKind,
} from "./file-kind"

describe("migrateLegacyFormat", () => {
  it("maps every legacy format value", () => {
    expect(migrateLegacyFormat("markdown")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.MARKDOWN,
    })
    expect(migrateLegacyFormat("json")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.JSON,
    })
    expect(migrateLegacyFormat("skill")).toEqual({
      type: fileType.SKILL,
      format: fileFormat.MARKDOWN,
    })
    expect(migrateLegacyFormat("storyboard")).toEqual({
      type: fileType.STORYBOARD,
      format: fileFormat.MARKDOWN,
    })
    expect(migrateLegacyFormat("image")).toEqual({
      type: fileType.IMAGE,
      format: fileFormat.FILE,
    })
    expect(migrateLegacyFormat("video")).toEqual({
      type: fileType.VIDEO,
      format: fileFormat.FILE,
    })
    expect(migrateLegacyFormat("audio")).toEqual({
      type: fileType.AUDIO,
      format: fileFormat.FILE,
    })
    expect(migrateLegacyFormat("html")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.HTML,
    })
    expect(migrateLegacyFormat("video-editor")).toEqual({
      type: fileType.VIDEO_EDITOR,
      format: fileFormat.JSON,
    })
    expect(migrateLegacyFormat("ai-generated")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.JSON,
    })
  })

  it("maps document assets to pdf when the content type is application/pdf", () => {
    expect(migrateLegacyFormat("document", "application/pdf")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.PDF,
    })
  })

  it("maps other document assets to file", () => {
    expect(migrateLegacyFormat("document", "application/zip")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.FILE,
    })
    expect(migrateLegacyFormat("document")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.FILE,
    })
  })

  it("leaves directories without a kind or syntax", () => {
    expect(migrateLegacyFormat(null)).toEqual({ type: null, format: null })
  })
})

describe("classifyFileKindFromContentType", () => {
  it("classifies image, video, and audio uploads as media files", () => {
    expect(classifyFileKindFromContentType("image/png")).toEqual({
      type: fileType.IMAGE,
      format: fileFormat.FILE,
    })
    expect(classifyFileKindFromContentType("video/mp4")).toEqual({
      type: fileType.VIDEO,
      format: fileFormat.FILE,
    })
    expect(classifyFileKindFromContentType("audio/mpeg")).toEqual({
      type: fileType.AUDIO,
      format: fileFormat.FILE,
    })
  })

  it("classifies html and pdf uploads as document syntax", () => {
    expect(classifyFileKindFromContentType("text/html")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.HTML,
    })
    expect(classifyFileKindFromContentType("application/pdf")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.PDF,
    })
  })

  it("classifies other binaries as document files", () => {
    expect(classifyFileKindFromContentType("application/zip")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.FILE,
    })
  })
})

describe("classifyFileKindFromAsset", () => {
  it("keeps media asset types on the file node", () => {
    expect(classifyFileKindFromAsset("image")).toEqual({
      type: fileType.IMAGE,
      format: fileFormat.FILE,
    })
  })

  it("maps html assets to document html", () => {
    expect(classifyFileKindFromAsset("html")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.HTML,
    })
  })

  it("maps document assets to pdf or file from content type", () => {
    expect(classifyFileKindFromAsset("document", "application/pdf")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.PDF,
    })
    expect(classifyFileKindFromAsset("document", "application/zip")).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.FILE,
    })
  })
})

describe("defaultFormatForType", () => {
  it("returns the default syntax for each file kind", () => {
    expect(defaultFormatForType(fileType.DOCUMENT)).toBe(fileFormat.MARKDOWN)
    expect(defaultFormatForType(fileType.SKILL)).toBe(fileFormat.MARKDOWN)
    expect(defaultFormatForType(fileType.STORYBOARD)).toBe(fileFormat.MARKDOWN)
    expect(defaultFormatForType(fileType.IMAGE)).toBe(fileFormat.FILE)
    expect(defaultFormatForType(fileType.VIDEO)).toBe(fileFormat.FILE)
    expect(defaultFormatForType(fileType.AUDIO)).toBe(fileFormat.FILE)
    expect(defaultFormatForType(fileType.VIDEO_EDITOR)).toBe(fileFormat.JSON)
  })
})

describe("isAllowedFileKind", () => {
  it("allows the formats each file type stores", () => {
    expect(isAllowedFileKind(fileType.DOCUMENT, fileFormat.MARKDOWN)).toBe(true)
    expect(isAllowedFileKind(fileType.DOCUMENT, fileFormat.JSON)).toBe(true)
    expect(isAllowedFileKind(fileType.DOCUMENT, fileFormat.HTML)).toBe(true)
    expect(isAllowedFileKind(fileType.DOCUMENT, fileFormat.PDF)).toBe(true)
    expect(isAllowedFileKind(fileType.DOCUMENT, fileFormat.FILE)).toBe(true)
    expect(isAllowedFileKind(fileType.SKILL, fileFormat.MARKDOWN)).toBe(true)
    expect(isAllowedFileKind(fileType.STORYBOARD, fileFormat.MARKDOWN)).toBe(
      true,
    )
    expect(isAllowedFileKind(fileType.IMAGE, fileFormat.FILE)).toBe(true)
    expect(isAllowedFileKind(fileType.VIDEO, fileFormat.FILE)).toBe(true)
    expect(isAllowedFileKind(fileType.AUDIO, fileFormat.FILE)).toBe(true)
    expect(isAllowedFileKind(fileType.VIDEO_EDITOR, fileFormat.JSON)).toBe(true)
  })

  it("rejects formats a file type does not store", () => {
    expect(isAllowedFileKind(fileType.SKILL, fileFormat.JSON)).toBe(false)
    expect(isAllowedFileKind(fileType.STORYBOARD, fileFormat.HTML)).toBe(false)
    expect(isAllowedFileKind(fileType.IMAGE, fileFormat.MARKDOWN)).toBe(false)
    expect(isAllowedFileKind(fileType.VIDEO_EDITOR, fileFormat.MARKDOWN)).toBe(
      false,
    )
  })
})

describe("resolveCreatedFileKind", () => {
  it("defaults files to document markdown", () => {
    expect(resolveCreatedFileKind({ directory: false })).toEqual({
      type: fileType.DOCUMENT,
      format: fileFormat.MARKDOWN,
    })
  })

  it("fills format from type when omitted", () => {
    expect(
      resolveCreatedFileKind({
        directory: false,
        type: fileType.VIDEO_EDITOR,
      }),
    ).toEqual({
      type: fileType.VIDEO_EDITOR,
      format: fileFormat.JSON,
    })
  })

  it("clears kind and syntax for directories", () => {
    expect(
      resolveCreatedFileKind({
        directory: true,
        type: fileType.DOCUMENT,
        format: fileFormat.MARKDOWN,
      }),
    ).toEqual({ type: null, format: null })
  })
})

describe("isMarkdownEditable", () => {
  it("allows markdown documents, storyboards, and skills", () => {
    expect(isMarkdownEditable(fileType.DOCUMENT, fileFormat.MARKDOWN)).toBe(
      true,
    )
    expect(isMarkdownEditable(fileType.STORYBOARD, fileFormat.MARKDOWN)).toBe(
      true,
    )
    expect(isMarkdownEditable(fileType.SKILL, fileFormat.MARKDOWN)).toBe(true)
  })

  it("rejects json, video-editor, and media files", () => {
    expect(isMarkdownEditable(fileType.DOCUMENT, fileFormat.JSON)).toBe(false)
    expect(isMarkdownEditable(fileType.VIDEO_EDITOR, fileFormat.JSON)).toBe(
      false,
    )
    expect(isMarkdownEditable(fileType.IMAGE, fileFormat.FILE)).toBe(false)
    expect(isMarkdownEditable(fileType.VIDEO, fileFormat.FILE)).toBe(false)
    expect(isMarkdownEditable(fileType.AUDIO, fileFormat.FILE)).toBe(false)
  })
})
