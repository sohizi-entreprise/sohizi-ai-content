import type { ContextArtifactMetadata } from "@/db/schema"

export const ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000
export const TOOL_RESULT_PREVIEW_LENGTH = 75

export type ArtifactAccess =
  | { ok: true }
  | { ok: false; reason: "not-found" | "expired" }

export function artifactExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + ARTIFACT_TTL_MS)
}

export function artifactAccess(
  artifact: { metadata: ContextArtifactMetadata; expireAt: Date } | null,
  scope: Pick<
    ContextArtifactMetadata,
    "projectId" | "conversationId" | "sessionId"
  >,
  now = new Date(),
): ArtifactAccess {
  if (!artifact || !sameArtifactScope(artifact.metadata, scope)) {
    return { ok: false, reason: "not-found" }
  }
  if (artifact.expireAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "expired" }
  }
  return { ok: true }
}

export function sameArtifactScope(
  metadata: ContextArtifactMetadata,
  scope: Pick<
    ContextArtifactMetadata,
    "projectId" | "conversationId" | "sessionId"
  >,
): boolean {
  if (metadata.projectId !== scope.projectId) return false
  if (scope.conversationId) {
    return metadata.conversationId === scope.conversationId
  }
  return metadata.sessionId === scope.sessionId
}

export function renderToolResult(output: unknown): string {
  if (output && typeof output === "object" && "value" in output) {
    const value = output.value
    return typeof value === "string" ? value : JSON.stringify(value)
  }
  return typeof output === "string" ? output : JSON.stringify(output)
}

export function truncatedToolResult(
  output: unknown,
  artifactId: string,
): string {
  const rendered = renderToolResult(output)
  const preview =
    rendered.length > TOOL_RESULT_PREVIEW_LENGTH
      ? `${rendered.slice(0, TOOL_RESULT_PREVIEW_LENGTH)}...`
      : rendered
  return `${preview}\nFull tool result saved as artifact ${artifactId}. Use getArtifact to read it.`
}

export function renderStoredArtifact(data: unknown): string {
  if (data && typeof data === "object" && "output" in data) {
    return renderToolResult(data.output)
  }
  return renderToolResult(data)
}
