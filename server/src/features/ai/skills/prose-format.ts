/**
 * ProseMirror Format Skill
 * 
 * Teaches the AI how to output content in ProseMirror/Tiptap JSON format.
 */

import type { Skill } from './types'

export const proseFormatSkill: Skill = () => `
---
name: formatting-prosemirror
description: Outputs content in ProseMirror/Tiptap JSON format for direct editor use. Use when generating script content that needs to be loaded into the editor.
---

## Task
Output script content in **ProseMirror JSON format**.

## Document Structure

\`\`\`json
{
  "type": "doc",
  "content": [/* block nodes */]
}
\`\`\`

## Node Types

### Block Nodes

**paragraph**
\`\`\`json
{"type": "paragraph", "content": [{"type": "text", "text": "Content"}]}
\`\`\`

**heading** (with level attr)
\`\`\`json
{"type": "heading", "attrs": {"level": 1}, "content": [{"type": "text", "text": "Title"}]}
\`\`\`

### Script-Specific Nodes

**sceneHeading**
\`\`\`json
{"type": "sceneHeading", "attrs": {"id": "scene_1"}, "content": [{"type": "text", "text": "INT. LOCATION - DAY"}]}
\`\`\`

**action**
\`\`\`json
{"type": "action", "content": [{"type": "text", "text": "Description of action"}]}
\`\`\`

**character**
\`\`\`json
{"type": "character", "attrs": {"characterId": "char_sarah"}, "content": [{"type": "text", "text": "SARAH"}]}
\`\`\`

**parenthetical**
\`\`\`json
{"type": "parenthetical", "content": [{"type": "text", "text": "(hesitantly)"}]}
\`\`\`

**dialogue**
\`\`\`json
{"type": "dialogue", "content": [{"type": "text", "text": "The spoken line"}]}
\`\`\`

**transition**
\`\`\`json
{"type": "transition", "content": [{"type": "text", "text": "CUT TO:"}]}
\`\`\`

### Text Formatting (Marks)

\`\`\`json
{"type": "text", "text": "Bold text", "marks": [{"type": "bold"}]}
\`\`\`

Available marks: bold, italic, underline, strike, code

## Critical Rules

1. Root must be \`type: "doc"\`
2. Text nodes are always leaves (have "text", not "content")
3. Marks are arrays, even for single marks
4. Valid JSON only - proper escaping required

## Output
Return valid ProseMirror JSON object directly (no markdown code blocks unless requested).
`

export const synopsisProseFormat = `
---
name: generating-synopsis-prose  
description: MANDATORY OUTPUT FORMAT - Synopsis must be a JSON array, not prose text.
---

## ⚠️ CRITICAL: OUTPUT FORMAT REQUIREMENT

**YOUR ENTIRE RESPONSE MUST BE A JSON ARRAY.**

- First character: \`[\`
- Last character: \`]\`
- NO prose text, NO markdown, NO explanation

## JSON Structure

| Key | Value |
|-----|-------|
| \`t\` | "h1" (title) or "p" (paragraph) |
| \`c\` | The text content as a string |

## Exact Format

[{"t":"h1","c":"Synopsis Title Here"},{"t":"p","c":"First paragraph of the synopsis..."},{"t":"p","c":"Second paragraph..."},{"t":"p","c":"Third paragraph..."}]

## Rules

1. Start response with \`[\` immediately
2. First node must be \`{"t":"h1","c":"..."}\` for the title
3. Following nodes are \`{"t":"p","c":"..."}\` for paragraphs  
4. Use \`\\"\` to escape quotes inside text
5. End with \`]\`

## WRONG ❌
Enemy at the Door
Marcus arrives home...

## CORRECT ✓
[{"t":"h1","c":"Enemy at the Door"},{"t":"p","c":"Marcus arrives home..."}]

`

export default proseFormatSkill
