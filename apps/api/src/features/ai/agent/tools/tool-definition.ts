import { z, toJSONSchema } from "zod"
import {
  AgenticToolChunk,
  OperationChunk,
  streamEvents,
  ToolCall,
  ToolResultComplete,
  VideoEditorChangeChunk,
} from "../utils/llm-response"
import type { AgentChunk } from "../core/agent"
import { Session } from "../core/session"
import { FilePendingOperation, VideoEditorChange } from "@/type"
import { Tool } from "ai"
import { AgentStateManager } from "../core/state-manager"
import { getErrorMessage } from "@/utils/get-error-message"

export type ToolResult = {
  success: boolean
  output: string
  metadata?: Record<string, unknown>
  operation?: FilePendingOperation[]
  videoEditorChanges?: VideoEditorChange[]
}

type AgenticToolResult =
  | AgentChunk
  | AgenticToolChunk
  | OperationChunk
  | VideoEditorChangeChunk

export type ToolExecutionOptions = {
  session: Session
  state: AgentStateManager
  abortSignal: AbortSignal
  artifacts: Map<string, unknown>
  toolCallId: string
  runId: string
}

interface BaseToolDefinition<T extends z.ZodType> {
  name: string
  description: string
  inputSchema: T
  execute: (
    input: z.infer<T>,
    options: ToolExecutionOptions,
  ) => Promise<ToolResult> | AsyncGenerator<AgenticToolResult, void, unknown>
}

export class BaseTool<T extends z.ZodType> {
  public readonly params: BaseToolDefinition<T>
  constructor(params: BaseToolDefinition<T>) {
    this.params = params
  }

  get schema(): Tool {
    return {
      title: this.params.name,
      description: this.params.description,
      inputSchema: this.params.inputSchema,
    }
  }

  async *execute(
    toolCall: ToolCall,
    options: Omit<ToolExecutionOptions, "toolCallId">,
  ): AsyncGenerator<
    ToolResultComplete | AgentChunk | OperationChunk | VideoEditorChangeChunk,
    void,
    unknown
  > {
    try {
      const args = this.validateInput(toolCall.input as z.infer<T>)
      const isGenerator =
        this.params.execute.constructor.name === "AsyncGeneratorFunction"
      const result = await this.params.execute(args, {
        ...options,
        toolCallId: toolCall.toolCallId,
      })
      if (isGenerator) {
        for await (const chunk of result as AsyncGenerator<
          AgenticToolResult,
          void,
          unknown
        >) {
          if (chunk.type === streamEvents.toolResultComplete) {
            yield {
              type: streamEvents.toolResultComplete,
              toolName: toolCall.toolName,
              toolCallId: toolCall.toolCallId,
              success: chunk.success,
              output: chunk.output,
              usage: chunk.usage,
            }
          } else {
            yield chunk
          }
        }
      } else {
        if ("operation" in result && result.operation) {
          const operations = result.operation.map((operation) => ({
            type: streamEvents.operation,
            operation,
          }))
          for (const operation of operations) {
            yield operation
          }
        }
        if ("videoEditorChanges" in result && result.videoEditorChanges) {
          for (const change of result.videoEditorChanges) {
            yield {
              type: streamEvents.videoEditorChange,
              change,
            }
          }
        }
        const event = this.buildEvent(toolCall, result as ToolResult)
        yield event
      }
    } catch (error) {
      const errorMsg = getErrorMessage(error)
      const event = this.buildEvent(toolCall, {
        success: false,
        output: errorMsg,
      })
      yield event
    }
  }

  validateInput(input: z.infer<T>): z.core.output<T> {
    const validated = this.params.inputSchema.safeParse(input)
    if (!validated.success) {
      throw new Error(
        `Your input is invalid: ${validated.error.message}. The expected input is:\n ${JSON.stringify(toJSONSchema(this.params.inputSchema))}.`,
      )
    }
    return validated.data
  }

  private buildEvent(
    toolCall: ToolCall,
    result: ToolResult,
  ): ToolResultComplete {
    return {
      type: streamEvents.toolResultComplete,
      toolName: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      success: result.success,
      output: result.output,
      usage: {
        input: 0,
        output: 0,
        reasoning: 0,
        cached: 0,
        total: 0,
        cost: 0,
      },
      metadata: result.metadata,
    }
  }
}

export const buildBaseTool = <T extends z.ZodType>(
  params: BaseToolDefinition<T>,
): BaseTool<T> => {
  return new BaseTool(params)
}
