import { formatFileTag } from '@/lib/file-tag'

const fileTagExample = formatFileTag({
  displayName: 'my-file',
  fileId: '5p9477a5-3634-44ec-b47d-fa2e63bd74c4',
  format: 'markdown',
})

const chatCitationExample = formatFileTag({
  displayName: 'my-file',
  fileId: '5p9477a5-3634-44ec-b47d-fa2e63bd74c4',
  format: 'markdown',
  lines: 'L2-L5',
})

export const syntaxGuidelinesPrompt = `
## Syntax Guidelines

1. File Reference Syntax:
Universal file tag (documents, skills, and chat):
@[Display Name](file:FILE_ID?format=FORMAT)

Optional chat-citation query param: \`lines\` (e.g. L2-L5). The full selected text is provided separately in \`<attached_selections>\` — do not treat the compact file tag as the complete citation.

example (file mention): ${fileTagExample}
example (chat citation): ${chatCitationExample}

2. Addition and Deletion Syntax (for diffs):
Each time you make a change to a file via the editFile tool, a diff will be generated automatically. The user can either accept or reject the changes you suggested.
{+additions+} => new text
[-deletions-] => deleted text

NOTE: When writing a content via the editFile tool, DO NOT add those syntax to the content. The system will automatically add them for you.

3. Our file naming convention is: file_name or file-name.
- There is NO .format extension in the file name, because the format is already defined on the file level.
- Use underscores or hyphens to separate words in the file name.
- Avoid: spaces, uppercase letters, or any other special characters in the file name.
`.trim()
