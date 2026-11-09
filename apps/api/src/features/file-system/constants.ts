export const fileFormat = {
  MARKDOWN: "markdown",
  JSON: "json",
  HTML: "html",
  PDF: "pdf",
  FILE: "file",
} as const

export const fileType = {
  DOCUMENT: "document",
  SKILL: "skill",
  STORYBOARD: "storyboard",
  IMAGE: "image",
  VIDEO: "video",
  AUDIO: "audio",
  VIDEO_EDITOR: "video-editor",
} as const

export const MAX_FILE_DEPTH = 5

/** Starter content for a new storyboard file: world bible plus one empty scene. */
export const DEFAULT_STORYBOARD_CONTENT = `---
aspectRatio: "16:9"
visualStyle: ""
colorPalette:
temporalContext: ""
---

:::scene
id: scene-1
title:
action:
environment:
lighting:

:::
`

export type FileFormat = (typeof fileFormat)[keyof typeof fileFormat]
export type FileType = (typeof fileType)[keyof typeof fileType]

export const FILE_FORMATS = [
  fileFormat.MARKDOWN,
  fileFormat.JSON,
  fileFormat.HTML,
  fileFormat.PDF,
  fileFormat.FILE,
] as const

export const FILE_TYPES = [
  fileType.DOCUMENT,
  fileType.SKILL,
  fileType.STORYBOARD,
  fileType.IMAGE,
  fileType.VIDEO,
  fileType.AUDIO,
  fileType.VIDEO_EDITOR,
] as const

export const MEDIA_FILE_TYPES = [
  fileType.IMAGE,
  fileType.VIDEO,
  fileType.AUDIO,
] as const
