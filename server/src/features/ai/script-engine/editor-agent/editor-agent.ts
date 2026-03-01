import { createOpenAI } from '@ai-sdk/openai'
import { ModelMessage, streamText } from 'ai'
import { v4 as uuidv4 } from 'uuid'

import { ResumableStream } from '@/lib'
import { skillRegistry } from './skill-registry'
import { buildEditorAgentPrompt } from './prompt'
import { loadSkills, todoWrite, editContent, delegateTask } from './tools'
import type { EditorAgentInput, EditComponent } from './types'
import { Project } from '@/db/schema'
import { buildProjectContext } from '../utils'

// ============================================================================
// TYPES
// ============================================================================

export type EditorAgentConfig = {
  model: string
  reasoningEffort?: 'low' | 'medium' | 'high'
}

export type EditorStreamData = {
  runId: string
  type?: 'reasoning' | 'content' | 'tool_call' | 'tool_result'
  text?: string
  error?: string
  toolName?: string
  toolId?: string
  args?: unknown
  result?: unknown
}

// ============================================================================
// EDITOR AGENT
// ============================================================================

export class EditorAgent {
  private model: string
  private reasoningEffort: 'low' | 'medium' | 'high'

  constructor(config: EditorAgentConfig) {
    this.model = config.model
    this.reasoningEffort = config.reasoningEffort ?? 'medium'
  }

  /**
   * Run the agent with the given input
   */
  async run(
    input: EditorAgentInput,
    stream: ResumableStream<EditorStreamData>,
    editComponent: EditComponent,
    project: Project
  ): Promise<void> {
    const runId = uuidv4()
    let totalTokens = 0

    // Create an AbortController to cancel the LLM request when the stream is cancelled
    const abortController = new AbortController()

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Build system prompt
    let systemPrompt = buildEditorAgentPrompt(skillRegistry.getCatalogAsString())
    const projectContext = buildProjectContext(project)
    systemPrompt = systemPrompt + '\n---\n' + projectContext

    // Build user message with context
    const userMessage = this.buildUserMessage(input)

    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ]

    try {
      // Push start event
      await stream.push({ type: 'editor_start', data: { runId } })

      const response = streamText({
        model: openai(this.model),
        system: systemPrompt,
        messages,
        tools: { loadSkills, todoWrite, editContent, delegateTask },
        abortSignal: abortController.signal,
        providerOptions: {
          openai: {
            reasoningEffort: this.reasoningEffort,
          },
        },
        onStepFinish: ({ usage }) => {
          totalTokens += usage.totalTokens || 0
        },
      })

      // Stream the response
      for await (const chunk of response.fullStream) {
        // Check if the stream is cancelled
        if (await stream.isCancelled()) {
          abortController.abort()
          await stream.push({ type: 'editor_end', data: { runId } })
          await stream.close()
          return
        }

        switch (chunk.type) {
          case 'reasoning-delta':
            await stream.push({
              type: 'editor_reasoning',
              data: { runId, type: 'reasoning', text: chunk.text },
            })
            break

          case 'text-delta':
            await stream.push({
              type: 'editor_delta',
              data: { runId, type: 'content', text: chunk.text },
            })
            break

          case 'error':
            await stream.push({
              type: 'editor_error',
              data: {
                runId,
                error: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
              },
            })
            break
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await stream.push({
        type: 'editor_error',
        data: { runId, error: errorMessage },
      })
    } finally {
      await stream.push({ type: 'editor_end', data: { runId } })
      await stream.close()
    }
  }

  /**
   * Build the user message with selection context
   */
  private buildUserMessage(input: EditorAgentInput): string {
    let message = input.message

    // if (input.context.selection) {
    //   message += `\n\n---\n**Selected Text:**\n"${input.context.selection.text}"`
    //   if (input.context.selection.blockId) {
    //     message += `\n(Block ID: ${input.context.selection.blockId})`
    //   }
    // }

    return message
  }
}
