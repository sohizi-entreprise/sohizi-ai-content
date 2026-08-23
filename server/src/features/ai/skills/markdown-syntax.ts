/**
 * Markdown Editor Syntax Skill
 *
 * Teaches the AI the exact markdown dialect used by TextEditorView and
 * SkillEditorView (TipTap + custom extensions). Use when writing or editing
 * markdown / skill instruction content so tags, media, and formatting render
 * correctly in the editor.
 */

import type { Skill } from './types'

export const markdownSyntaxSkill: Skill = () => `
---
name: formatting-markdown
description: Writes content using the project's TipTap markdown dialect — file tags, image layouts, YouTube embeds, and all editor-supported formatting. Use when creating or editing markdown files or skill instructions.
---

## Task
Output content in **Sohizi editor markdown** so it round-trips correctly through TextEditorView and SkillEditorView.

Do **not** invent alternate mention, embed, or layout syntax. Use only the forms below.

## Universal File Tag Syntax

One syntax everywhere (documents, skills, and chat):

\`\`\`
@[Display Name](file:FILE_ID?format=FORMAT)
\`\`\`

Optional chat-citation query param (read-only for you in user messages — do **not** write this into file content):

\`\`\`
@[Display Name](file:FILE_ID?format=FORMAT&lines=L2-L5)
\`\`\`

The full selected text is provided separately in \`<attached_selections>\`. Do not treat the compact file tag as the complete citation.

---

## File Mentions (inline)

Tag another project file inside the document:

\`\`\`
@[Display Name](file:FILE_ID?format=FORMAT)
\`\`\`

Rules:
- \`Display Name\` — the file's display name (no path, no extension)
- \`FILE_ID\` — the real file node UUID from explore/search tools (never invent IDs)
- \`FORMAT\` — one of: \`markdown\`, \`json\`, \`skill\`, \`image\`, \`video\`, \`audio\`, \`document\`, \`html\`, \`video-editor\`, \`ai-generated\`
- \`lines\` — optional; only appear in chat citations, never invent them in documents
- Inline only — place inside a paragraph or heading, not on its own as a fake block
- Leave a trailing space after the mention when continuing text

Examples:
\`\`\`
See @[character-bible](file:5p9477a5-3634-44ec-b47d-fa2e63bd74c4?format=markdown) for voice notes.

Reference @[hero-portrait](file:a1b2c3d4-e5f6-7890-abcd-ef1234567890?format=image) in the scene.
\`\`\`

WRONG ❌
- \`@character-bible\`
- \`@[character-bible](5p9477a5-…)\`
- \`@[character-bible](file:5p9477a5-…)\` (missing \`?format=\`)
- \`@[character-bible | L2-L5](ID: … | Snippet: …)\` (legacy chat form — superseded)

---

## Images

### A. Simple image (markdown files)

Standard markdown image — use when you already have a public/asset URL:

\`\`\`
![Alt text](https://example.com/image.png)
\`\`\`

Optional title:
\`\`\`
![Alt text](https://example.com/image.png "Optional title")
\`\`\`

### B. Image layout block (preferred for structured layouts)

Use HTML image-layout blocks. Supported \`data-layout\` values:

| Layout | Slots | Content column |
|--------|-------|----------------|
| \`single\` | 1 image | no |
| \`double-horizontal\` | 2 images side by side | no |
| \`image-left-content\` | 1 image | yes (right) |
| \`image-right-content\` | 1 image | yes (left) |

\`data-images\` is a JSON array of \`{ "url": string, "name": string }\`. Escape quotes as \`&quot;\` inside the attribute.

**Single image:**
\`\`\`
<div data-type="image-layout" data-layout="single" data-images="[{&quot;url&quot;:&quot;https://example.com/a.png&quot;,&quot;name&quot;:&quot;Hero&quot;}]">
<img src="https://example.com/a.png" alt="Hero" />
<div data-slot="content"><p></p></div>
</div>
\`\`\`

**Two images:**
\`\`\`
<div data-type="image-layout" data-layout="double-horizontal" data-images="[{&quot;url&quot;:&quot;https://example.com/a.png&quot;,&quot;name&quot;:&quot;Left&quot;},{&quot;url&quot;:&quot;https://example.com/b.png&quot;,&quot;name&quot;:&quot;Right&quot;}]">
<img src="https://example.com/a.png" alt="Left" />
<img src="https://example.com/b.png" alt="Right" />
<div data-slot="content"><p></p></div>
</div>
\`\`\`

**Image + text (left image):**
\`\`\`
<div data-type="image-layout" data-layout="image-left-content" data-images="[{&quot;url&quot;:&quot;https://example.com/a.png&quot;,&quot;name&quot;:&quot;Portrait&quot;}]">
<img src="https://example.com/a.png" alt="Portrait" />
<div data-slot="content"><p>Caption or body text beside the image.</p></div>
</div>
\`\`\`

Rules:
- Always include \`data-type="image-layout"\`, \`data-layout\`, and \`data-images\`
- Always include the inner \`<div data-slot="content">…</div>\` (use \`<p></p>\` when empty)
- Prefer real asset URLs from the project; empty \`url\` shows an upload placeholder in the UI

---

## YouTube Embeds (markdown files)

Self-closing Pandoc-style block (one line):

\`\`\`
:::youtube {src="https://www.youtube.com/watch?v=VIDEO_ID"} :::
\`\`\`

Optional attributes: \`width\`, \`height\`, \`start\` (seconds).

\`\`\`
:::youtube {src="https://youtu.be/VIDEO_ID" width="640" height="360" start="30"} :::
\`\`\`

Accepted URL shapes: \`youtube.com/watch?v=\`, \`youtu.be/\`, \`youtube.com/embed/\`, \`youtube.com/shorts/\`, \`youtube-nocookie.com\`.

WRONG ❌
- Bare YouTube URLs as the only embed mechanism when you need a guaranteed player block
- Inventing HTML iframe wrappers instead of \`:::youtube … :::\`
- Using YouTube blocks inside **skill** files (skill editor does not register the YouTube extension)

---

## Inline Formatting

| Effect | Syntax |
|--------|--------|
| Bold | \`**text**\` or \`__text__\` |
| Italic | \`*text*\` or \`_text_\` |
| Strikethrough | \`~~text~~\` |
| Underline | \`++text++\` |
| Highlight | \`==text==\` |
| Inline code | single backtick around text |
| Link | \`[label](https://example.com)\` |

Combine marks when needed: \`**==important==**\`, \`[++underlined link++](https://example.com)\`.

Note: Highlight (\`==…==\`) is supported in markdown files. Prefer plain emphasis in skill instructions if unsure.

---

## Block Structure

### Headings (levels 1–3 only)
\`\`\`
# Heading 1
## Heading 2
### Heading 3
\`\`\`

### Paragraphs & hard breaks
- Separate paragraphs with a blank line
- Soft line break: two trailing spaces or \`<br>\` when needed inside HTML-aligned blocks

### Lists
\`\`\`
- Bullet item
- Nested
  - child

1. Numbered item
2. Second

- [ ] Unchecked task
- [x] Checked task
\`\`\`

### Blockquote
\`\`\`
> Quoted line
\`\`\`

### Horizontal rule
\`\`\`
---
\`\`\`

### Code block
Fenced with triple backticks (language tag optional):

~~~~
\`\`\`
code here
\`\`\`
~~~~

### Tables (GFM)
\`\`\`
| Column A | Column B |
| -------- | -------- |
| cell     | cell     |
\`\`\`

---

## Text Alignment

Default (left) — use normal markdown.

Non-default alignment must be HTML with inline style on \`p\` or \`h1\`–\`h3\`:

\`\`\`
<p style="text-align: center">Centered paragraph</p>

<h2 style="text-align: right">Right-aligned heading</h2>
\`\`\`

Allowed values: \`left\`, \`center\`, \`right\`, \`justify\`.

File mentions inside aligned HTML stay in the document form:
\`@[Label](file:ID?format=markdown)\`

---

## Editor Coverage

| Feature | Markdown files | Skill instructions |
|---------|----------------|--------------------|
| File mentions | yes | yes |
| Image layouts | yes | yes |
| Simple \`![]()\` images | yes | avoid (use layouts) |
| YouTube \`:::youtube\` | yes | no |
| Highlight \`==…==\` | yes | no |
| Links, tables, tasks, align | yes | yes (shared subset) |

---

## Output Rules

1. Emit raw markdown/HTML as file content — do not wrap the whole document in a \`\`\`markdown fence unless the user asks for an example.
2. Never invent file IDs; resolve them with tools first, then emit \`@[…](file:…?format=…)\`.
3. Never write \`lines\` query params into document content — those are chat-citation only.
4. Never write diff markers (\`{+…+}\`, \`[-…-]\`) into content — the system adds those.
5. Prefer image-layout blocks for placed imagery; use \`:::youtube {src="…"} :::\` for video embeds in markdown files.
6. Keep headings at h1–h3 only.
`

export default markdownSyntaxSkill
