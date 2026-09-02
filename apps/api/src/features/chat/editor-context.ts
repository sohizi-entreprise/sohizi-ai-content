import { z } from 'zod'

export const attachedSelectionSchema = z.object({
  file: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  selectedText: z.string(),
  textBefore: z.string().optional(),
  textAfter: z.string().optional(),
  isEntireFile: z.boolean(),
})

export const editorContextSchema = z.object({
  focusedTab: z.string().nullable(),
  openTabs: z.array(z.string()),
  selections: z.array(attachedSelectionSchema),
})

export type AttachedSelection = z.infer<typeof attachedSelectionSchema>
export type EditorContext = z.infer<typeof editorContextSchema>

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeXmlAttr(value: string): string {
  return escapeXmlText(value).replace(/"/g, '&quot;')
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
}

function renderSelection(selection: AttachedSelection): string {
  const attrs = [
    `file="${escapeXmlAttr(selection.file)}"`,
    `start_line="${selection.startLine}"`,
    `end_line="${selection.endLine}"`,
    `entire_file="${selection.isEntireFile}"`,
  ].join(' ')

  const parts = [`  <selection ${attrs}>`]
  if (selection.textBefore) {
    parts.push(`    <text_before>${cdata(selection.textBefore)}</text_before>`)
  }
  parts.push(`    <selected>${cdata(selection.selectedText)}</selected>`)
  if (selection.textAfter) {
    parts.push(`    <text_after>${cdata(selection.textAfter)}</text_after>`)
  }
  parts.push('  </selection>')
  return parts.join('\n')
}

export function buildEditorContextPrompt(
  editorContext?: EditorContext,
): string {
  if (!editorContext) return ''

  const hasFocusedTab = Boolean(editorContext.focusedTab)
  const hasOpenTabs = editorContext.openTabs.length > 0
  const hasSelections = editorContext.selections.length > 0
  if (!hasFocusedTab && !hasOpenTabs && !hasSelections) return ''

  const blocks: string[] = []

  if (hasFocusedTab || hasOpenTabs) {
    const lines = [
      '<editor_state>',
      'The user\'s editor at the time of this message. Prefer these files when the request is about "this file" or current work.',
    ]
    if (editorContext.focusedTab) {
      lines.push(
        `  <focused_tab>${escapeXmlText(editorContext.focusedTab)}</focused_tab>`,
      )
    }
    if (hasOpenTabs) {
      lines.push('  <open_tabs>')
      lines.push('    Files on the tab bar that are not currently visible.')
      for (const file of editorContext.openTabs) {
        lines.push(`    <file>${escapeXmlText(file)}</file>`)
      }
      lines.push('  </open_tabs>')
    }
    lines.push('</editor_state>')
    blocks.push(lines.join('\n'))
  }

  if (hasSelections) {
    const lines = [
      '<attached_selections>',
      'Text the user explicitly attached. This is the cited content; do not treat the compact file tag in the user message as the full selection.',
      ...editorContext.selections.map(renderSelection),
      '</attached_selections>',
    ]
    blocks.push(lines.join('\n'))
  }

  return blocks.join('\n\n')
}
