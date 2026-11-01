import { describe, expect, it } from "bun:test"
import type { ContextArtifactMetadata } from "@/db/schema"
import {
  ARTIFACT_TTL_MS,
  artifactAccess,
  artifactExpiresAt,
  truncatedToolResult,
} from "./context-artifact-format"

const metadata: ContextArtifactMetadata = {
  projectId: "project-1",
  conversationId: "conversation-1",
  sessionId: "session-1",
  toolName: "exploreFile",
  toolCallId: "call-1",
}

const scope = {
  projectId: "project-1",
  conversationId: "conversation-1",
  sessionId: "session-1",
}

describe("context artifact access", () => {
  it("expires artifacts 24 hours after creation", () => {
    const now = new Date("2026-10-22T00:00:00.000Z")
    expect(artifactExpiresAt(now).getTime() - now.getTime()).toBe(
      ARTIFACT_TTL_MS,
    )
    expect(ARTIFACT_TTL_MS).toBe(24 * 60 * 60 * 1000)
  })

  it("hides artifacts from another conversation and reports expiry only in scope", () => {
    const artifact = {
      metadata,
      expireAt: new Date("2026-10-23T00:00:00.000Z"),
    }
    expect(
      artifactAccess(artifact, { ...scope, conversationId: "other" }),
    ).toEqual({ ok: false, reason: "not-found" })
    expect(
      artifactAccess(
        { ...artifact, expireAt: new Date("2026-10-21T00:00:00.000Z") },
        scope,
        new Date("2026-10-22T00:00:00.000Z"),
      ),
    ).toEqual({ ok: false, reason: "expired" })
    expect(artifactAccess(null, scope)).toEqual({
      ok: false,
      reason: "not-found",
    })
  })

  it("keeps a 75-character preview and the artifact id", () => {
    const text = truncatedToolResult(
      { type: "text", value: "y".repeat(80) },
      "11111111-1111-4111-8111-111111111111",
    )
    expect(text.startsWith(`${"y".repeat(75)}...`)).toBe(true)
    expect(text).toContain(
      "Full tool result saved as artifact 11111111-1111-4111-8111-111111111111",
    )
  })
})
