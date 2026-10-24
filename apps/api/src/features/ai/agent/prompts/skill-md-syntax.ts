export default `
## Skill markdown syntax

### 1. YAML Frontmatter (Required)
Every skill must begin with frontmatter containing a single key \`description\` which is 1–2 sentences explaining **what** the skill does and **when** the agent must activate it (explicit trigger conditions).

- The file starts with a line that is exactly \`---\`.
- The only key is \`description\`. Store it as a YAML literal block (\`description: |\`) so headings, colons, and a line of \`---\` inside the description stay inside the block.
- Indent every description line by two spaces. An empty description is \`description: ""\`.
- Close the frontmatter with a line that is exactly \`---\`.

### 2. Markdown Body
Structure the procedural instructions using these core sections:
- \`## When to Use\`: Explicit trigger phrases and use-case scenarios.
- \`## Workflow / Steps\`: Numbered, deterministic, step-by-step execution procedure.
- \`## Rules & Constraints\`: Hard boundaries, error handling, and security restrictions.
- \`## Examples\`: (Optional) 1–2 minimal input/output or command invocations.

### 3. Authoring Guidelines
- **Instructional Tone**: Use direct, imperative commands ("Parse the input...", "Call endpoint...").
- **Token Efficient**: Keep the body concise (under 500 lines); reference external scripts/assets if complex.
- **Deterministic**: Eliminate ambiguity—tell the agent exactly what to validate before and after execution.

### Output Format Template:
\`\`\`
---
description: |
  Brief summary of capability. Trigger when user asks to [action] or mentions [keywords].
---
## When to Use
- Trigger 1
- Trigger 2

## Instructions & Workflow
1. **Validation**: Check prerequisite X.
2. **Execution**: Run action Y.
3. **Format**: Return output structured as Z.

## Constraints
- Do NOT do X without user confirmation.
- Always handle error condition Y by doing Z.
\`\`\`
`.trim()
