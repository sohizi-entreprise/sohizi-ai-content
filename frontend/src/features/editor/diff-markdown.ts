/** Apply pending changes: keep `{+additions+}`, remove `[-deletions-]`. */
export function acceptDiffMarkdown(text: string) {
  return text
    .replace(/\[-[\s\S]*?-\]/g, '')
    .replace(/\{\+([\s\S]*?)\+\}/g, '$1')
}

/** Reject pending changes: keep `[-deletions-]`, remove `{+additions+}`. */
export function rejectDiffMarkdown(text: string) {
  return text
    .replace(/\{\+[\s\S]*?\+\}/g, '')
    .replace(/\[-([\s\S]*?)-\]/g, '$1')
}
