import { useChatStore } from "../store/chat-store"
import { partitionAttachedFiles } from "./attached-files"
import type { Editor } from "@tiptap/core"
import type { EditorTab } from "@/features/editor/types"
import type { AttachedSelection, EditorContext } from "../types"
import { formatFileTag } from "@/lib/file-tag"
import { useEditorStore } from "@/features/editor/stores/editor-store"

const CONTEXT_WORD_LIMIT = 200
const TRUNCATE_KEEP_WORDS = 50
const ADJACENT_WORD_COUNT = 5
const WHITESPACE = /^\s+$/

function isWhitespace(token: string): boolean {
  return WHITESPACE.test(token)
}

function splitKeepingWhitespace(text: string): Array<string> {
  return text.split(/(\s+)/).filter((part) => part.length > 0)
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function takeFirstWords(text: string, n: number): string {
  if (n <= 0 || !text) return ""
  const parts = splitKeepingWhitespace(text)
  let wordCount = 0
  const out: Array<string> = []
  for (const part of parts) {
    if (isWhitespace(part)) {
      if (wordCount === 0) continue
      if (wordCount >= n) break
      out.push(part)
      continue
    }
    if (wordCount >= n) break
    out.push(part)
    wordCount += 1
  }
  return out.join("").trimEnd()
}

function takeLastWords(text: string, n: number): string {
  if (n <= 0 || !text) return ""
  const parts = splitKeepingWhitespace(text)
  let wordCount = 0
  const out: Array<string> = []
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const part = parts[i]
    if (isWhitespace(part)) {
      if (wordCount === 0) continue
      if (wordCount >= n) break
      out.unshift(part)
      continue
    }
    if (wordCount >= n) break
    out.unshift(part)
    wordCount += 1
  }
  return out.join("").trimStart()
}

function truncateSelectedText(text: string): string {
  if (countWords(text) <= CONTEXT_WORD_LIMIT) return text
  return `${takeFirstWords(text, TRUNCATE_KEEP_WORDS)} [Truncated] ... ${takeLastWords(text, TRUNCATE_KEEP_WORDS)}`
}

function adjacentWords(text: string, fromEnd: boolean): string | undefined {
  const result = fromEnd
    ? takeLastWords(text, ADJACENT_WORD_COUNT)
    : takeFirstWords(text, ADJACENT_WORD_COUNT)
  return result.length > 0 ? result : undefined
}

function tabToFileTag(tab: EditorTab): string | null {
  if (!tab.path) return null
  return formatFileTag({
    displayName: tab.name,
    path: tab.path,
  })
}

export function buildAttachedSelection(params: {
  editor: Editor
  file: { id: string; name: string; format: string; path: string }
  from: number
  to: number
}): AttachedSelection | null {
  const { editor, file, from, to } = params
  const selectedText = editor.state.doc.textBetween(from, to, "\n")
  if (!selectedText) return null

  const fullText = editor.state.doc.textBetween(
    0,
    editor.state.doc.content.size,
    "\n",
  )
  const isEntireFile = selectedText === fullText
  const textBeforeDoc = editor.state.doc.textBetween(0, from, "\n")
  const textThroughSelection = editor.state.doc.textBetween(0, to, "\n")
  const textAfterDoc = editor.state.doc.textBetween(
    to,
    editor.state.doc.content.size,
    "\n",
  )

  return {
    file: formatFileTag({
      displayName: file.name,
      path: file.path,
    }),
    startLine: textBeforeDoc.split("\n").length,
    endLine: textThroughSelection.split("\n").length,
    selectedText: truncateSelectedText(selectedText),
    isEntireFile,
    ...(isEntireFile
      ? {}
      : {
          textBefore: adjacentWords(textBeforeDoc, true),
          textAfter: adjacentWords(textAfterDoc, false),
        }),
  }
}

function isAttachedSelection(value: unknown): value is AttachedSelection {
  if (!value || typeof value !== "object") return false
  const candidate = value as AttachedSelection
  return (
    typeof candidate.file === "string" &&
    typeof candidate.startLine === "number" &&
    typeof candidate.endLine === "number" &&
    typeof candidate.selectedText === "string" &&
    typeof candidate.isEntireFile === "boolean"
  )
}

function collectSelectionsFromChatEditor(
  editor: Editor | null,
): Array<AttachedSelection> {
  if (!editor) return []
  const selections: Array<AttachedSelection> = []
  editor.state.doc.descendants((node) => {
    if (!node.isText) return
    for (const mark of node.marks) {
      if (mark.type.name !== "link") continue
      if (isAttachedSelection(mark.attrs.selection)) {
        selections.push(mark.attrs.selection)
      }
    }
  })
  return selections
}

export function captureLocalTime(date = new Date()): {
  localTime: string
  timeZone: string
} {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const pad = (value: number, length = 2) => String(value).padStart(length, "0")
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const absolute = Math.abs(offsetMinutes)
  const offset = `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  const localTime = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}${offset}`

  return { localTime, timeZone }
}

export function buildEditorContext(chatEditor: Editor | null): EditorContext {
  const { openTabs, activeTabId } = useEditorStore.getState()
  const focused = openTabs.find((tab) => tab.id === activeTabId)
  const focusedTab = focused ? tabToFileTag(focused) : null
  const backgroundTabs = openTabs
    .filter((tab) => tab.id !== activeTabId)
    .map(tabToFileTag)
    .filter((tag): tag is string => tag !== null)
  const { loadedFiles, availableFiles } = partitionAttachedFiles(
    useChatStore.getState().attachedFiles,
  )
  const { localTime, timeZone } = captureLocalTime()

  return {
    focusedTab,
    openTabs: backgroundTabs,
    selections: collectSelectionsFromChatEditor(chatEditor),
    localTime,
    timeZone,
    loadedFiles,
    availableFiles,
  }
}
