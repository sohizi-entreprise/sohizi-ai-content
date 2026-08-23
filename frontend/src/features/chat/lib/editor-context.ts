import type { Editor } from '@tiptap/core'
import { formatFileTag } from '@/lib/file-tag'
import type { EditorTab } from '@/features/editor/types'
import type { AttachedSelection, EditorContext } from '../types'
import { useEditorStore } from '@/features/editor/stores/editor-store'

const CONTEXT_WORD_LIMIT = 200
const TRUNCATE_KEEP_WORDS = 50
const ADJACENT_WORD_COUNT = 5
const WHITESPACE = /^\s+$/

function isWhitespace(token: string): boolean {
  return WHITESPACE.test(token)
}

function splitKeepingWhitespace(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0)
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

export function takeFirstWords(text: string, n: number): string {
  if (n <= 0 || !text) return ''
  const parts = splitKeepingWhitespace(text)
  let wordCount = 0
  const out: string[] = []
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
  return out.join('').trimEnd()
}

export function takeLastWords(text: string, n: number): string {
  if (n <= 0 || !text) return ''
  const parts = splitKeepingWhitespace(text)
  let wordCount = 0
  const out: string[] = []
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
  return out.join('').trimStart()
}

export function truncateSelectedText(text: string): string {
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
  if (!tab.format) return null
  return formatFileTag({
    displayName: tab.name,
    fileId: tab.id,
    format: tab.format,
  })
}

export function buildAttachedSelection(params: {
  editor: Editor
  file: { id: string; name: string; format: string }
  from: number
  to: number
}): AttachedSelection | null {
  const { editor, file, from, to } = params
  const selectedText = editor.state.doc.textBetween(from, to, '\n')
  if (!selectedText) return null

  const fullText = editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n')
  const isEntireFile = selectedText === fullText
  const textBeforeDoc = editor.state.doc.textBetween(0, from, '\n')
  const textThroughSelection = editor.state.doc.textBetween(0, to, '\n')
  const textAfterDoc = editor.state.doc.textBetween(to, editor.state.doc.content.size, '\n')

  return {
    file: formatFileTag({
      displayName: file.name,
      fileId: file.id,
      format: file.format,
    }),
    startLine: textBeforeDoc.split('\n').length,
    endLine: textThroughSelection.split('\n').length,
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
  if (!value || typeof value !== 'object') return false
  const candidate = value as AttachedSelection
  return (
    typeof candidate.file === 'string' &&
    typeof candidate.startLine === 'number' &&
    typeof candidate.endLine === 'number' &&
    typeof candidate.selectedText === 'string' &&
    typeof candidate.isEntireFile === 'boolean'
  )
}

export function collectSelectionsFromChatEditor(editor: Editor | null): AttachedSelection[] {
  if (!editor) return []
  const selections: AttachedSelection[] = []
  editor.state.doc.descendants((node) => {
    if (node.type.name !== 'fileMention') return
    if (isAttachedSelection(node.attrs.selection)) {
      selections.push(node.attrs.selection)
    }
  })
  return selections
}

export function buildEditorContext(chatEditor: Editor | null): EditorContext {
  const { openTabs, activeTabId } = useEditorStore.getState()
  const focused = openTabs.find((tab) => tab.id === activeTabId)
  const focusedTab = focused ? tabToFileTag(focused) : null
  const backgroundTabs = openTabs
    .filter((tab) => tab.id !== activeTabId)
    .map(tabToFileTag)
    .filter((tag): tag is string => tag !== null)

  return {
    focusedTab,
    openTabs: backgroundTabs,
    selections: collectSelectionsFromChatEditor(chatEditor),
  }
}
