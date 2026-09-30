export type SkillDocument = {
  description: string
  instructions: string
}

export type SkillFileMetadata = {
  status: "draft" | "published"
  visibility: "private" | "public"
}

export const DEFAULT_SKILL_METADATA: SkillFileMetadata = {
  status: "draft",
  visibility: "private",
}

export const EMPTY_SKILL_CONTENT = serializeSkillDocument({
  description: "",
  instructions: "",
})

export function resolveSkillFileMetadata(
  metadata: Record<string, unknown> | null | undefined,
  fallback?: { status?: string; visibility?: string } | null,
): SkillFileMetadata {
  const status =
    metadata?.status === "published" || metadata?.status === "draft"
      ? metadata.status
      : fallback?.status === "published" || fallback?.status === "draft"
        ? fallback.status
        : DEFAULT_SKILL_METADATA.status
  const visibility =
    metadata?.visibility === "public" || metadata?.visibility === "private"
      ? metadata.visibility
      : fallback?.visibility === "public" || fallback?.visibility === "private"
        ? fallback.visibility
        : DEFAULT_SKILL_METADATA.visibility
  return { status, visibility }
}

export function serializeSkillDocument(skill: SkillDocument): string {
  return `---\n${serializeDescription(skill.description)}\n---\n${skill.instructions}`
}

export function parseSkillDocument(content: string): SkillDocument | null {
  const lines = content.replace(/\r\n/g, "\n").split("\n")
  if (lines[0] !== "---") return null

  let closeIndex = -1
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      closeIndex = index
      break
    }
  }
  if (closeIndex === -1) return null

  const description = parseDescription(lines.slice(1, closeIndex))
  if (description === null) return null

  return {
    description,
    instructions: lines.slice(closeIndex + 1).join("\n"),
  }
}

function serializeDescription(description: string): string {
  if (description === "") {
    return 'description: ""'
  }

  const indented = description
    .split("\n")
    .map((line) => (line.length === 0 ? "" : `  ${line}`))
    .join("\n")
  return `description: |\n${indented}`
}

function parseDescription(yamlLines: string[]): string | null {
  if (yamlLines.length === 0) return null

  const first = yamlLines[0]
  if (
    first === "description: |" ||
    first === "description: |-" ||
    first === "description: |+"
  ) {
    return yamlLines
      .slice(1)
      .map((line) => (line.startsWith("  ") ? line.slice(2) : line))
      .join("\n")
  }

  if (
    first === 'description: ""' ||
    first === "description: ''" ||
    first === "description:"
  ) {
    return ""
  }

  const quoted = first.match(/^description:\s+("[\s\S]*"|'[\s\S]*')$/)
  if (quoted) {
    return unquoteYamlString(quoted[1])
  }

  if (first.startsWith("description: ")) {
    return first.slice("description: ".length)
  }

  return null
}

function unquoteYamlString(value: string): string {
  const quote = value[0]
  const inner = value.slice(1, -1)
  if (quote === '"') {
    return inner
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
  }
  return inner.replace(/\\'/g, "'")
}
