import { z } from "zod"
import { buildBaseTool } from "./tool-definition"
import { failure, success } from "./utils"
import {
  artifactAccess,
  getContextArtifact,
  renderStoredArtifact,
} from "../core/context-artifacts"

export const getArtifactTool = buildBaseTool({
  name: "getArtifact",
  description:
    "Read the full tool result saved during context compression. Pass the artifact id from a truncated tool result. Artifacts expire 24 hours after they are saved.",
  inputSchema: z.object({
    artifactId: z.uuid(),
  }),
  execute: async ({ artifactId }, { session }) => {
    const artifact = await getContextArtifact(artifactId)
    const access = artifactAccess(artifact, {
      projectId: session.projectId,
      conversationId: session.conversationId ?? null,
      sessionId: session.id,
    })
    if (!access.ok || !artifact) {
      return failure(
        !access.ok && access.reason === "expired"
          ? "Artifact expired."
          : "Artifact not found.",
      )
    }
    return success(renderStoredArtifact(artifact.data))
  },
})
