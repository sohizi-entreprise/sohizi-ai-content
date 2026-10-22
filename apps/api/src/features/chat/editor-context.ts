import { z } from "zod"

export const attachedSelectionSchema = z.object({
  file: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  selectedText: z.string(),
  textBefore: z.string().optional(),
  textAfter: z.string().optional(),
  isEntireFile: z.boolean(),
})

export const chatAttachmentKindSchema = z.enum([
  "image",
  "pdf",
  "text",
  "video",
  "audio",
  "file",
])

export const loadedChatFileSchema = z.object({
  messagePartIndex: z.number().int().positive(),
  userIndex: z.number().int().positive(),
  type: chatAttachmentKindSchema,
  mediaType: z.string().min(1),
  url: z.string().min(1),
})

export const availableChatFileSchema = z.object({
  userIndex: z.number().int().positive(),
  type: chatAttachmentKindSchema,
  mediaType: z.string().min(1),
  url: z.string().min(1),
})

export const editorContextSchema = z.object({
  focusedTab: z.string().nullable(),
  openTabs: z.array(z.string()),
  selections: z.array(attachedSelectionSchema),
  localTime: z.string().default(""),
  timeZone: z.string().default(""),
  loadedFiles: z.array(loadedChatFileSchema).default([]),
  availableFiles: z.array(availableChatFileSchema).default([]),
})

export type AttachedSelection = z.infer<typeof attachedSelectionSchema>
export type EditorContext = z.infer<typeof editorContextSchema>

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replace(/"/g, "&quot;")
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`
}

function renderSelection(selection: AttachedSelection): string {
  const attrs = [
    `file="${escapeXmlAttr(selection.file)}"`,
    `start_line="${selection.startLine}"`,
    `end_line="${selection.endLine}"`,
    `entire_file="${selection.isEntireFile}"`,
  ].join(" ")

  const parts = [`  <selection ${attrs}>`]
  if (selection.textBefore) {
    parts.push(`    <text_before>${cdata(selection.textBefore)}</text_before>`)
  }
  parts.push(`    <selected>${cdata(selection.selectedText)}</selected>`)
  if (selection.textAfter) {
    parts.push(`    <text_after>${cdata(selection.textAfter)}</text_after>`)
  }
  parts.push("  </selection>")
  return parts.join("\n")
}

function renderLocalTime(localTime: string, timeZone: string): string | null {
  if (!localTime) return null
  const timezone = timeZone ? ` timezone="${escapeXmlAttr(timeZone)}"` : ""
  return `<user_local_time${timezone}>${escapeXmlText(localTime)}</user_local_time>`
}

function renderAttachedFiles(
  loadedFiles: EditorContext["loadedFiles"],
  availableFiles: EditorContext["availableFiles"],
): string | null {
  if (loadedFiles.length === 0 && availableFiles.length === 0) return null

  const lines = [
    "<attached_files>",
    "loaded_file parts are included in the user message content. message_part_index is the 0-based index of the part within that content. Index 0 refers to the text part.",
    "user_index is the 1-based position of an uploaded attachment in the order shown to the user. Use user_index when the user refers to an attachment by its position, such as the first file or file 2",
    "available_file parts are not included in the user message content, but they still have a user_index indicating their position among the user's attachments.",
  ]
  for (const file of loadedFiles) {
    lines.push(
      `  <loaded_file message_part_index="${file.messagePartIndex}" user_index="${file.userIndex}" type="${escapeXmlAttr(file.type)}" media_type="${escapeXmlAttr(file.mediaType)}" url="${escapeXmlAttr(file.url)}" />`,
    )
  }
  for (const file of availableFiles) {
    lines.push(
      `  <available_file user_index="${file.userIndex}" type="${escapeXmlAttr(file.type)}" media_type="${escapeXmlAttr(file.mediaType)}" url="${escapeXmlAttr(file.url)}" />`,
    )
  }
  lines.push("</attached_files>")
  return lines.join("\n")
}

export function buildEditorContextPrompt(
  editorContext?: EditorContext,
): string {
  if (!editorContext) return ""

  const hasFocusedTab = Boolean(editorContext.focusedTab)
  const hasOpenTabs = editorContext.openTabs.length > 0
  const hasSelections = editorContext.selections.length > 0
  const localTime = renderLocalTime(
    editorContext.localTime ?? "",
    editorContext.timeZone ?? "",
  )
  const attachedFiles = renderAttachedFiles(
    editorContext.loadedFiles ?? [],
    editorContext.availableFiles ?? [],
  )
  if (
    !hasFocusedTab &&
    !hasOpenTabs &&
    !hasSelections &&
    !localTime &&
    !attachedFiles
  ) {
    return ""
  }

  const blocks: string[] = []

  if (localTime) blocks.push(localTime)

  if (hasFocusedTab || hasOpenTabs) {
    const lines = [
      "<editor_state>",
      'The user\'s editor at the time of this message. Prefer these files when the request is about "this file" or current work.',
    ]
    if (editorContext.focusedTab) {
      lines.push(
        `  <focused_tab>${escapeXmlText(editorContext.focusedTab)}</focused_tab>`,
      )
    }
    if (hasOpenTabs) {
      lines.push("  <open_tabs>")
      lines.push("    Files on the tab bar that are not currently visible.")
      for (const file of editorContext.openTabs) {
        lines.push(`    <file>${escapeXmlText(file)}</file>`)
      }
      lines.push("  </open_tabs>")
    }
    lines.push("</editor_state>")
    blocks.push(lines.join("\n"))
  }

  if (hasSelections) {
    const lines = [
      "<attached_selections>",
      "Text the user explicitly attached. This is the cited content; do not treat the compact file tag in the user message as the full selection.",
      ...editorContext.selections.map(renderSelection),
      "</attached_selections>",
    ]
    blocks.push(lines.join("\n"))
  }

  if (attachedFiles) blocks.push(attachedFiles)

  return blocks.join("\n\n")
}
