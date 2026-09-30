export default `
## Storyboard markdown

Storyboard files are container markdown, not ordinary documents. The editor parses a YAML world-bible front matter block, then \`:::scene\` blocks that contain \`:::shot\` blocks. Headings, paragraphs, lists, and HTML outside this syntax are dropped.

Start every file with the world-bible front matter. After the closing \`---\`, write one or more scenes, separated by a blank line. A file must contain at least one scene. A scene may contain zero shots.

\`\`\`
---
aspectRatio: "16:9"
visualStyle: "Gritty neo-noir, practical light, wet streets."
colorPalette:
  - "#1a1a1a"
  - "#c4a574"
temporalContext: "Present day, late autumn"
---

:::scene
id: scene-1
title: Arrival
description: A detective enters an abandoned warehouse.
environment: Abandoned warehouse on the docks, night.
lighting: One practical bulb overhead, hard shadows.

:::shot
id: shot-1
number: 1
image: https://example.com/shot-1.jpg
action: Wide establishing shot of the warehouse.
camera:
  angle: low angle
  movement: slow push in
:::

:::shot
id: shot-2
number: 2
action: The detective opens the door.
dialogue:
  - speaker: DETECTIVE
    text: Hello?
narration: Wind moves through the rafters.
:::
:::
\`\`\`

### Front matter
- Open the file with a line that is exactly \`---\`. Close the world bible with a line that is exactly \`---\`.
- This block is the world bible for every scene. Keep it at the top of the file.
- \`aspectRatio\`: one of \`16:9\`, \`9:16\`, \`1:1\`, \`4:3\`, \`4:5\`, \`21:9\`, \`2.39:1\`. Quote the value.
- \`visualStyle\`: one line describing the shared visual language. Quote the value.
- \`colorPalette\`: a YAML list of hex colors. Each item is indented, a dash, then a quoted \`#rrggbb\` value. Leave the key with no items when the palette is empty.
- \`temporalContext\`: one line for when the story takes place. Quote the value.

### Fences
- Open a scene with a line that is exactly \`:::scene\`. Open a shot with a line that is exactly \`:::shot\`. No space after the colons, and no attributes on the fence line.
- Close each shot with a line that is exactly \`:::\`, then close the scene with its own \`:::\`. The shot close comes before the scene close.
- Put shots inside the scene, after the scene fields.

### Fields
Keys start at column 0. Each value stays on that same line. Do not wrap a value, and do not indent \`id\`, \`title\`, \`description\`, \`environment\`, \`lighting\`, \`number\`, \`image\`, \`action\`, or \`narration\`.

Scene, in this order:
- \`id\`: stable id, unique in the file. Keep an existing id when you edit that scene.
- \`title\`: scene name shown above the scene body.
- \`description\`: one sentence for what happens in the scene. This is the scene summary, not a shot description.
- \`environment\`: location and time of day.
- \`lighting\`: how the scene is lit.

Shot, in this order. Omit \`image\`, \`dialogue\`, \`narration\`, and \`camera\` when they are empty:
- \`id\`: stable id, unique in the file. Keep an existing id when you edit that shot.
- \`number\`: 1-based position of the shot inside its scene. After inserting, deleting, or reordering, renumber that scene from 1.
- \`image\`: a real image URL only. Never invent a path.
- \`action\`: one line describing what the shot shows. This is the shot description on the card.
- \`dialogue\`: spoken lines. The key is alone on its line. Each line is an indented speaker plus a \`text\` line indented under it:
  \`\`\`
  dialogue:
    - speaker: DETECTIVE
      text: Hello?
  \`\`\`
- \`narration\`: optional voice-over, one line. Dialogue is separate from narration.
- \`camera\`: angle and movement. The key is alone on its line. Indent the fields:
  \`\`\`
  camera:
    angle: low angle
    movement: slow push in
  \`\`\`

New scenes and shots need new ids (\`scene-3\`, \`shot-7\`). Do not reuse an id already in the file, and do not change an id unless that scene or shot is being replaced.
`.trim()
