export default `
## Skill markdown

Skill files are markdown with a YAML description at the top. The file name is the skill identifier. Do not put \`name\` in the frontmatter.

Create project skills at \`/root/core/skills/<skill-name>\`. Call this syntax before the first \`editFile\` write or patch on a skill.

\`\`\`
---
description: |
  Use this when writing a scene.

  Keep the tone dry.
---
Write the scene in present tense.
\`\`\`

### Frontmatter
- The file starts with a line that is exactly \`---\`.
- The only key is \`description\`. Store it as a YAML literal block (\`description: |\`) so headings, colons, and a line of \`---\` inside the description stay inside the block.
- Indent every description line by two spaces. An empty description is \`description: ""\`.
- Close the frontmatter with a line that is exactly \`---\`.

### Instructions
- Everything after the closing \`---\` is the skill instructions, as ordinary markdown.
- Edit the description only inside the frontmatter block. Edit the instructions only after the closing \`---\`.
- Preserve the frontmatter fences when you patch. Do not convert the file to JSON or to a document without frontmatter.
`.trim()
