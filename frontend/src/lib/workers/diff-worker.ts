import { diffChars } from 'diff'
import type { Change } from 'diff'

self.onmessage = function (e: MessageEvent) {
  const { oldText, newText, messageId } = e.data

  try {
    if (oldText === newText) {
      self.postMessage({ success: true, diff: null, messageId })
      return
    }

    const diff = createCompactTextDiff(oldText, newText)

    self.postMessage({ success: true, diff, messageId })
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      messageId,
    })
  }
}

type CompactTextDiff = {
  version: 1
  baseLength: number
  targetLength: number
  edits: Array<{
    start: number
    deleteCount: number
    insert: string
  }>
}

function createCompactTextDiff(
  oldText: string,
  newText: string,
): CompactTextDiff {
  const edits: CompactTextDiff['edits'] = []
  let oldIndex = 0
  let currentEdit: CompactTextDiff['edits'][number] | null = null

  const flushEdit = () => {
    if (
      currentEdit &&
      (currentEdit.deleteCount > 0 || currentEdit.insert.length > 0)
    ) {
      edits.push(currentEdit)
    }
    currentEdit = null
  }

  const ensureEdit = () => {
    currentEdit ??= { start: oldIndex, deleteCount: 0, insert: '' }
    return currentEdit
  }

  diffChars(oldText, newText).forEach((part: Change) => {
    if (!part.added && !part.removed) {
      flushEdit()
      oldIndex += part.value.length
      return
    }

    const edit = ensureEdit()

    if (part.removed) {
      edit.deleteCount += part.value.length
      oldIndex += part.value.length
      return
    }

    edit.insert += part.value
  })

  flushEdit()

  return {
    version: 1,
    baseLength: oldText.length,
    targetLength: newText.length,
    edits,
  }
}
