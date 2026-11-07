export default `
## Document UI Markdown Syntax

Document files (\`type: "document"\`, \`format: "markdown"\`) support standard GitHub-Flavored Markdown (headings, paragraphs, bold/italic, lists, task lists, tables, blockquotes, and clickable file tags \`[Display Name](/root/path)\`) plus **10 structured UI components** rendered as interactive blocks in the editor.

Use these UI components whenever authoring or updating plans, brainstorms, scripts, research notes, character/concept sheets, or treatments so the document is visual, scannable, and easy to review.

---

### General Formatting & Diff Rules
1. **Fence lines**: Open every block component at column 0 with \`:::<tag>\` (no spaces after \`:::\`, no attributes on the fence line) and close it with a line that is exactly \`:::\`.
2. **Blank lines around blocks**: Always separate block components from surrounding paragraphs, headings, or other blocks with a single blank line.
3. **Header keys**: Put metadata keys at column 0 (\`key: value\`), one key per line, in the exact order shown for each component. Do not wrap a header value across multiple lines and do not quote values.
4. **One item per line for clean diffs**: Keep list entries inside \`:::palette\`, \`:::moodboard\`, \`:::timeline\`, \`:::properties\`, and \`:::tree\` on a single line so edits produce minimal 1-line diffs.

---

### 1. Media Block — \`:::media\`
Use to embed an image, video (including YouTube URLs), or audio asset with a descriptive caption.

\`\`\`markdown
:::media
type: image
url: https://example.com/frame.jpg
alt: Wide establishing shot of the rain-slicked street
:::
\`\`\`

- \`type\`: \`image\` | \`video\` | \`audio\` (required, first line).
- \`url\`: direct asset URL or YouTube URL (required, second line). Never invent a URL.
- \`alt\`: one-line description of what the media shows or locks in (optional, third line).

---

### 2. Sources Block — \`:::sources\`
Use when citing web research, visual analyses, or reference articles.

\`\`\`markdown
:::sources
title: Cinematography Research

- [Neo-Noir Lighting](https://example.com/noir)
  | Film lighting techniques

- [Blade Runner Visual Analysis](https://example.com/blade-runner)
  | Atmospheric color and composition

- [1970s Cinematography](https://example.com/1970s)
  | Vintage lenses and film grain
:::
\`\`\`

- Optional header key: \`title: <section title>\` followed by a blank line.
- Each item starts with \`- [Title](url)\` on the first line, followed by \`  | <one-line description>\` indented by two spaces on the next line.
- Separate multiple source entries with a single blank line.

---

### 3. Color Palette Block — \`:::palette\`
Use to define a project or scene color palette with hex codes and role labels.

\`\`\`markdown
:::palette
- #1a1a1a | Background Noir
- #c4a574 | Warm Key Light
- #e63946 | Danger Accent
:::
\`\`\`

- Each line is \`- #<6-digit-hex> | <Role or Label>\`.

---

### 4. Card Block — \`:::card\`
Use for structured entities such as character profiles, location/prop reference cards, brainstorm concepts/angles, or key story beats. The body after the blank line supports regular Markdown.

\`\`\`markdown
:::card
title: The Last Broadcast
subtitle: Film concept
badge: Concept
image: https://example.com/concept.jpg

A lonely radio host receives a mysterious transmission
from a city that no longer exists.

**Genre:** Sci-fi thriller

**Tone:** Melancholic, mysterious
:::
\`\`\`

- Header keys, in this order (omit any key that is empty):
  1. \`title\`: primary card title.
  2. \`subtitle\`: secondary context or role.
  3. \`badge\`: short category/status pill (e.g., \`Concept\`, \`Character\`, \`Location\`, \`Option A\`).
  4. \`image\`: real image URL only (omit when no image applies).
- Leave one blank line after the header keys, then write regular Markdown for the card body.

---

### 5. Moodboard Block — \`:::moodboard\`
Use to group multiple visual references into a titled grid board.

\`\`\`markdown
:::moodboard
title: Visual Atmosphere

- https://example.com/street.jpg | Wet streets
- https://example.com/portrait.jpg | Character lighting
- https://example.com/interior.jpg | Interior atmosphere
- https://example.com/texture.jpg | Film grain
:::
\`\`\`

- Optional header keys:
  1. \`title\`: board title.
  2. \`columns\`: \`2\` | \`3\` (defaults to \`2\`, omit when \`2\`).
- Leave one blank line after any header keys, then list each image as \`- <url> | <one-line caption>\`.

---

### 6. Narrative Timeline Block — \`:::timeline\`
Use for narrative pacing, scene breakdowns, and story beat durations (not for frame-level video editing timelines).

\`\`\`markdown
:::timeline
title: The Last Broadcast

- 8s | The mysterious signal | scene-01
- 12s | Entering the abandoned city | scene-02
- 6s | Discovering the truth | scene-03
- 4s | Final reveal | scene-04
:::
\`\`\`

- Header key: \`title: <timeline title>\`.
- Leave one blank line after \`title\`, then list each beat in order as:
  \`- <duration> | <beat summary> | <scene reference>\`
  (for example \`8s\`, \`15s\`, \`0:30\`).

---

### 7. Properties Block — \`:::properties\`
Compact metadata block designed for short, scannable key-value pairs such as duration, aspect ratio, camera angle, status, and mood.

\`\`\`markdown
:::properties
title: Video Specifications
layout: grid
- Duration: 8s
- Aspect Ratio: 16:9
- Camera: Wide shot
- Mood: Suspenseful
:::
\`\`\`

- Header keys:
  1. \`title\`: section title (e.g., \`Video Specifications\`, \`Shot Specs\`).
  2. \`layout\`: \`grid\` | \`list\` | \`inline\` (defaults to \`grid\`).
- List each property on its own line as \`- <Key>: <Short Value>\`.

---

### 8. Attributes Block — \`:::attributes\`
Designed for longer explanations where each property or creative pillar needs room to breathe.

\`\`\`markdown
:::attributes
title: Creative Direction

- Visual Style:
  1970s neo-noir cinematography with deep shadows,
  wet pavement, and subtle analog film grain.

- Camera Movement:
  Slow, deliberate tracking shots that gradually
  reveal the environment.

- Lighting:
  Warm sodium-vapor streetlights contrasting
  with cool blue ambient shadows.
:::
\`\`\`

- Header key: \`title: <section title>\` followed by a blank line.
- Each entry starts with \`- <Label>:\` on its own line, followed by one or more two-space-indented explanation lines.
- Separate multiple attribute entries with a single blank line.

---

### 9. Hierarchy Tree Block — \`:::tree\`
Use for hierarchical structures and parent-child dependencies, such as production phase breakdowns, scenes and shots, asset trees, or project file structures.

\`\`\`markdown
:::tree
- Video Production | 30-second cinematic brand film
  - Pre-production | Creative direction and planning
    - Script Development | Narrative, dialogue and scene structure
    - Storyboard | Visual composition and shot references
  - Production | Generate and assemble visual assets
    - Scene 01 — The Discovery | An unexpected signal appears in the city
      - Opening wide shot | 8s, slow cinematic dolly-in
      - Character close-up | 4s, emotional reaction
  - Post-production | Editing, sound and final delivery
    - Sound Design | Music, ambience and voiceover
:::
\`\`\`

- Start with the root item at column 0 (\`- <Root Label> | <Description>\`) and indent child nodes by two spaces per nesting level (\`  - ...\`).
- Format each node on a single line as \`- <Node Label> | <One-line description or metadata>\` (the \`| <description>\` part is optional).

---

### 10. Inline Badge — \`:badge[label]{color=...}\`
Use inline inside paragraphs, list items, tables, or card bodies to highlight status, priority, consistency locks, or decisions.

\`\`\`markdown
Status: :badge[Approved]{color=highlight} — ready for production.
\`\`\`

- Syntax: \`:badge[<label>]{color=<color>}\`
- Allowed \`color\` values: \`highlight\` | \`warning\` | \`danger\` | \`neutral\`.

---

### 11. Text Alignment — \`:::center\` & \`:::right\`
Left alignment is the default for all Markdown blocks and does not use a fence. Wrap headings or paragraphs in \`:::center\` or \`:::right\` when centered or right-aligned presentation is needed (such as script title headers, credits, or transitions). The inner body supports full rich Markdown.

\`\`\`markdown
:::center
# THE LAST BROADCAST

Written by **Jane Doe** — :badge[Locked]{color=highlight}
:::

:::right
CUT TO:
:::
\`\`\`

- Allowed alignment fences: \`:::center\` | \`:::right\` (never emit \`:::left\`).
- Group consecutive blocks that share the same alignment inside a single fence block, separated by a blank line.
`.trim()
