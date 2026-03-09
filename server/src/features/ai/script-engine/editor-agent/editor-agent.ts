import { createOpenAI } from '@ai-sdk/openai'
import { LanguageModelUsage, ModelMessage, stepCountIs, streamText } from 'ai'
import { v4 as uuidv4 } from 'uuid'

import { ResumableStream } from '@/lib'
import { skillRegistry } from './skill-registry'
import { readContent, loadSkills, todoWrite, editContent, delegateTask } from './tools'
import type { EditorAgentInput, EditComponent, AgentEvent, RunContext, TokenUsage, Trace, EditorStreamData, ConversationMessage } from './types'
import { Project } from '@/db/schema'
import { buildProjectContext } from '../utils'
import { chatRepo } from '@/entities/chat'
import { AgentRunFinishReason, ChatMetadata, MsgTextPart, MsgToolCallPart, MsgToolResultPart } from '@/type'
import { buildEditorAgentPrompt } from '../../prompts/editor-agent'

// ============================================================================
// TYPES
// ============================================================================

export type EditorAgentConfig = {
  model: string
  reasoningEffort?: 'low' | 'medium' | 'high'
}

export type RunParams = {
  project: Project
  conversationId: string
  runId: string
  stream: ResumableStream<AgentEvent>
  editComponent: EditComponent,
  maxIterations?: number
}

// ============================================================================
// EDITOR AGENT
// ============================================================================

export class EditorAgent {
  private model: string
  private reasoningEffort: 'low' | 'medium' | 'high'
  private usage: TokenUsage

  constructor(config: EditorAgentConfig) {
    this.model = config.model
    this.reasoningEffort = config.reasoningEffort ?? 'medium'
    this.usage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }
  }

  /**
   * Run the agent with the given input.
   * Returns the accumulated assistant text for persistence.
   */
  async run(params: RunParams) {
    const { project, conversationId, runId, stream, editComponent, maxIterations=10 } = params

    const abortController = new AbortController()

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Build system prompt with project context
    const systemPrompt = buildEditorAgentPrompt({skillCatalog: skillRegistry.getCatalogAsString(), project, editTarget: editComponent})

    const messages: ModelMessage[] = await this.getMessageHistory(conversationId)

    // RunContext passed to tools via experimental_context
    const runContext: RunContext = {
      stream,
      project,
      runId
    }

    let stepId = uuidv4()

    try {
      await stream.push({type: 'editor_start', data: {runId}})

      const response = streamText({
        model: openai(this.model),
        system: systemPrompt,
        messages,
        tools: { readContent, loadSkills, todoWrite, editContent, delegateTask },
        stopWhen: stepCountIs(maxIterations),
        abortSignal: abortController.signal,
        providerOptions: {
          openai: {
            reasoningEffort: this.reasoningEffort,
            reasoningSummary: 'auto'
          },
        },
        experimental_context: runContext,
        onStepFinish: async({ usage, staticToolCalls, staticToolResults, reasoningText, text, finishReason}) => {
          this.updateUsage(usage)
          // Update the agent run

          let runFinishReason: AgentRunFinishReason = 'not-finished'
          if(finishReason === 'stop'){
            runFinishReason = 'response'
          }else if(finishReason === 'error'){
            runFinishReason = 'error'
          }else if(finishReason === 'tool-calls'){
            runFinishReason = 'tool-calls'
          }

          await this.updateRun(runId, {
            finishReason: runFinishReason, 
            metadata: {
              spentTokens: {
                input: this.usage.inputTokens,
                output: this.usage.outputTokens,
              },
              selectedModel: this.model,
            }
          })

          const toolCalls: MsgToolCallPart[] = staticToolCalls.map((call) => ({
            type: 'tool-call',
            toolName: call.toolName,
            input: call.input,
            toolCallId: call.toolCallId,
          }))

          const toolResults: MsgToolResultPart[] = staticToolResults.map((result) => ({
            type: 'tool-result',
            toolName: result.toolName,
            toolCallId: result.toolCallId,
            output: {
              type: result.output.success ? 'text' : 'error-text',
              value: result.output.text,
            },
          }))

          const agentMessage: chatRepo.CreateMessageData = {
            conversationId,
            runId,
            role: 'assistant' as const,
            content: [
              {
                type: 'text' as const,
                text,
              }
            ],
            metadata: {
              reasoningText,
            }
          }

          switch (finishReason) {
            case 'tool-calls':
              agentMessage.content = [...agentMessage.content, ...toolCalls]
              await this.persistMessages([agentMessage])

              // Persist the tool results id any
              if(toolResults.length > 0){
                await this.persistMessages([{
                  conversationId,
                  runId,
                  role: 'tool',
                  content: toolResults,
                }])
              }
              break

            case 'stop':
              await this.persistMessages([agentMessage])
              break
            
            case 'error':
              // await this.updateRun(runId, {finishReason: 'error', error: text})
              break

            default:
              if(toolResults.length > 0){
                await this.persistMessages([{
                  conversationId,
                  runId,
                  role: 'tool',
                  content: toolResults,
                }])
              }
              break
          }

          stepId = uuidv4()
          
        },
        onAbort: async()=>{
          await this.updateRun(runId, {finishReason: 'aborted'})
        },
        onError: async({error})=>{
          console.log('Error event =======================', error)
          await this.updateRun(runId, {finishReason: 'error', error: error instanceof Error ? error.message : String(error)})
        },
        onFinish: async({text, finishReason, totalUsage})=>{

        }
      })

      for await (const chunk of response.fullStream) {
        if (await stream.isCancelled()) {
          abortController.abort()
          await stream.push({ type: 'editor_end', data: { runId } })
          await stream.close()
        }

        switch (chunk.type) {
          case 'reasoning-delta':
            await stream.push({
              type: 'editor_reasoning',
              data: { runId, type: 'reasoning_delta', text: chunk.text, stepId },
            })
            break

          case 'text-delta':
            await stream.push({
              type: 'editor_delta',
              data: { runId, type: 'text_delta', text: chunk.text, stepId },
            })
            break

          case 'tool-call':
            await stream.push({
              type: 'editor_delta',
              data: {
                runId,
                type: 'tool_call_delta',
                metadata:{
                  toolName: chunk.toolName,
                  toolId: chunk.toolCallId,
                  args: chunk.input,
                },
                stepId
              },
            })
            break

          case 'error':
            await stream.push({
              type: 'editor_error',
              data: {
                runId,
                type: 'error',
                text: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
              },
            })
            break
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await stream.push({
        type: 'editor_error',
        data: { runId, type: 'error', text: errorMessage },
      })
    } finally {
      await stream.push({ type: 'editor_end', data: { runId } })
      await stream.close()
    }

  }

  private updateUsage(usage: LanguageModelUsage): void {
    this.usage.inputTokens += (usage.inputTokens || 0)
    this.usage.outputTokens += (usage.outputTokens || 0)
    this.usage.totalTokens += (usage.totalTokens || 0)
  }

  private async persistMessages( data: chatRepo.CreateMessageData[]) {
    await chatRepo.createMessagesBulk(data)
  }

  private async getMessageHistory(conversationId: string){
    // By default we get the last 50 messages
    const result = await chatRepo.ListMessagesByConversationId(conversationId, {limit: 50})
    const messages = result.data
    // The last message will be the user message
    const userMessage = messages.pop()
    if(!userMessage){
      throw new Error('No user message found')
    }

    // Build the context for the user message
    const context = userMessage.metadata?.context || {}
    const textContext = `
    Bocks or selections to edit:
    ${context.blocks?.join('\n')}
    ${context.selections?.join('\n')}
    `
    // construct a new user message with the context
    const newUserMessage: ConversationMessage = {
      role: 'user',
      content: [
        {
          type: 'text',
          text: (userMessage.content[0] as MsgTextPart).text // + '\n' + textContext,
        }
      ]
    }


    const history = messages.map((message)=>({
      role: message.role,
      content: message.content,
      metadata: message.metadata,
    }))

    return [...history, newUserMessage] as ConversationMessage[]
  }

  private async updateRun(runId: string, 
                          data:{finishReason: AgentRunFinishReason; 
                            error?: string;
                            metadata?: ChatMetadata}) {
    const { finishReason, error, metadata } = data
    await chatRepo.updateAgentRun(runId, { finishReason, error, metadata })
  }
}
