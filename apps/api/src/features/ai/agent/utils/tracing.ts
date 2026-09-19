import { context, trace } from "@opentelemetry/api"
import {
  propagateAttributes,
  startActiveObservation,
  startObservation,
} from "@langfuse/tracing"
import { forceFlushTracing, isLangfuseEnabled } from "@/instrumentation"
import type { Session } from "../core/session"
import { streamEvents } from "./llm-response"

export type AgentTraceEntrypoint =
  "chat" | "media-generation" | "motion-graphic"

const UNTRACED_TOOL_NAMES = new Set(["assignTask"])

export function getTracingEnvironment(): string {
  return (
    process.env.LANGFUSE_TRACING_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development"
  )
}

export function getTraceAttributes(
  session: Session,
  options: {
    agentName: string
    entrypoint: AgentTraceEntrypoint
  },
) {
  const metadata: Record<string, string> = {
    organizationId: session.organizationId,
    projectId: session.projectId,
    conversationRunId: session.runId,
    agentSessionId: session.id,
    agentName: options.agentName,
    entrypoint: options.entrypoint,
    environment: getTracingEnvironment(),
  }
  if (session.conversationId) {
    metadata.conversationId = session.conversationId
  }

  return {
    userId: session.userId,
    sessionId: session.conversationId ?? session.runId,
    tags: ["agent", options.entrypoint, options.agentName],
    metadata,
    traceName: `run-${options.agentName}`,
  }
}

export async function withAgentTrace<T>(
  session: Session,
  options: {
    agentName: string
    entrypoint: AgentTraceEntrypoint
    input: string
  },
  fn: (updateOutput: (output: unknown) => void) => Promise<T>,
): Promise<T> {
  if (!isLangfuseEnabled()) {
    return fn(() => undefined)
  }

  const attributes = getTraceAttributes(session, options)

  try {
    return await startActiveObservation(
      `run-${options.agentName}`,
      async (observation) => {
        observation.update({ input: options.input })
        let output: unknown
        try {
          return await propagateAttributes(attributes, () =>
            fn((value) => {
              output = value
            }),
          )
        } catch (error) {
          observation.update({
            level: "ERROR",
            statusMessage:
              error instanceof Error ? error.message : String(error),
          })
          throw error
        } finally {
          if (output !== undefined) {
            observation.update({ output })
          }
        }
      },
      { asType: "agent" },
    )
  } finally {
    await forceFlushTracing()
  }
}

export async function withSubAgentObservation<T>(
  agentName: string,
  instructions: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isLangfuseEnabled()) {
    return fn()
  }

  return startActiveObservation(
    `run-${agentName}`,
    async (observation) => {
      observation.update({
        input: instructions,
        metadata: { agentName },
      })
      const result = await fn()
      observation.update({ output: result })
      return result
    },
    { asType: "agent" },
  )
}

export async function* observeToolExecution<
  T extends { type: string; output?: string },
>(
  toolName: string,
  input: unknown,
  generator: AsyncGenerator<T, void, unknown>,
): AsyncGenerator<T, void, unknown> {
  if (!isLangfuseEnabled() || UNTRACED_TOOL_NAMES.has(toolName)) {
    yield* generator
    return
  }

  const observation = startObservation(toolName, { input }, { asType: "tool" })
  const activeContext = trace.setSpan(context.active(), observation.otelSpan)

  try {
    while (true) {
      const next = await context.with(activeContext, () => generator.next())
      if (next.done) {
        return
      }
      if (
        next.value.type === streamEvents.toolResultComplete &&
        typeof next.value.output === "string"
      ) {
        observation.update({ output: next.value.output })
      }
      yield next.value
    }
  } catch (error) {
    observation.update({
      level: "ERROR",
      statusMessage: error instanceof Error ? error.message : String(error),
    })
    throw error
  } finally {
    observation.end()
  }
}

export function textFromAgentChunk(chunk: {
  type: string
  text?: string
}): string | undefined {
  if (chunk.type === streamEvents.textDelta && typeof chunk.text === "string") {
    return chunk.text
  }
  if (
    chunk.type === streamEvents.progressUpdate &&
    typeof chunk.text === "string"
  ) {
    return chunk.text
  }
  return undefined
}
