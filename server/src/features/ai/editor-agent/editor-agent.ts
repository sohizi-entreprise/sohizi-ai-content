import { createOpenAI } from '@ai-sdk/openai'
import { LanguageModelUsage, ModelMessage, stepCountIs, streamText } from 'ai'
import { v4 as uuidv4 } from 'uuid'

import type { StreamEvent } from '@/lib'
import { buildDocumentBlockIndex } from './document-index'
import { skillRegistry } from './skill-registry'
import { getEditorOperationsPayload } from './utils'
import { loadSkills, 
         todoWrite, 
         editContent, 
         delegateTask, 
         readScreenplayOutline, 
         readEntityOutline, 
         readComponentDetails, 
         readProjectRequirements, 
         searchScreenplay, 
         readStoryContext, 
         readComponentSchema, 
         rewriteStoryComponent, 
         rewriteProjectComponent, 
         insertScene, 
         createEntity, 
         deleteProjectComponent } from './tools'
import type { EditComponent, AgentEvent, RunContext, TokenUsage, ConversationMessage, EditorAgentOutput } from './types'
import { Project } from '@/db/schema'
import { chatRepo } from '@/entities/chat'
import { AgentRunFinishReason, ChatMetadata, MsgTextPart, MsgToolCallPart, MsgToolResultPart } from '@/type'
import { buildEditorAgentPrompt } from '../prompts/editor-agent'
import { projectRepo } from '@/entities/project'
import { BaseGeneratorParams } from '../type'

// ============================================================================
// TYPES 
// ============================================================================

export type EditorAgentConfig = {
  model: string
  reasoningEffort?: 'low' | 'medium' | 'high'
}

export type RunPayload = {
  projectId: string
  conversationId: string
  runId: string
  editComponent: EditComponent,
  maxIterations?: number
}

export type RunParams = BaseGeneratorParams<EditorAgentOutput, RunPayload>

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
  async *run(params: RunParams): AsyncGenerator<AgentEvent, void, unknown> {
    const { payload, onSuccess, onError, onAbort, abortSignal, onUsageUpdate } = params
    const { projectId, conversationId, runId, editComponent, maxIterations=10 } = payload

    const project = await projectRepo.getProjectById(projectId)

    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Build system prompt with project context
    const systemPrompt = buildEditorAgentPrompt({skillCatalog: skillRegistry.getCatalogAsString(), project})

    const messages: ModelMessage[] = await this.getMessageHistory(conversationId)

    // RunContext passed to tools via experimental_context
    const documentIndex = buildDocumentBlockIndex(project)
    const runContext: RunContext = {
      project,
      runId,
      documentIndex,
    }

    let stepId = uuidv4()
    let finalResponse = ''
    const toolsUsed = new Set<string>()
    let didAbort = false
    let didError = false
    const pendingOperationEvents: AgentEvent[] = []

    try {
      yield { type: 'start', runId }

      const response = streamText({
        model: openai(this.model),
        system: systemPrompt,
        messages,
        tools: {
          loadSkills,
          todoWrite,
          editContent,
          delegateTask,
          rewriteStoryComponent,
          rewriteProjectComponent,
          insertScene,
          createEntity,
          deleteProjectComponent,
          readScreenplayOutline,
          readEntityOutline,
          readComponentDetails,
          readProjectRequirements,
          searchScreenplay,
          readStoryContext,
          readComponentSchema,
        },
        stopWhen: stepCountIs(maxIterations),
        abortSignal,
        providerOptions: {
          openai: {
            reasoningEffort: this.reasoningEffort,
            reasoningSummary: 'auto'
          },
        },
        experimental_context: runContext,
        onStepFinish: async({ usage, staticToolCalls, staticToolResults, reasoningText, text, finishReason}) => {
          const currentStepId = stepId
          this.updateUsage(usage)
          await onUsageUpdate({
            inputTokens: usage.inputTokens || 0,
            outputTokens: usage.outputTokens || 0,
            totalTokens: usage.totalTokens || 0,
            model: this.model,
          })
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

          staticToolResults.forEach((result) => {
            const payload = getEditorOperationsPayload(result.output)
            if (!payload) {
              return
            }

            pendingOperationEvents.push({
              type: 'editor_operation',
              runId,
              stepId: currentStepId,
              documentId: payload.documentId,
              operations: payload.operations,
              metadata: {
                toolName: result.toolName,
                toolId: result.toolCallId,
              },
            })
          })

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

          staticToolCalls.forEach((call) => toolsUsed.add(call.toolName))
          if (text) {
            finalResponse = text
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
          didAbort = true
          await this.updateRun(runId, {finishReason: 'aborted'})
          await onAbort()
        },
        onError: async({error})=>{
          didError = true
          console.log('Error event =======================', error)
          const resolvedError = error instanceof Error ? error : new Error(String(error))
          await this.updateRun(runId, {finishReason: 'error', error: resolvedError.message})
          await onError(resolvedError)
        }
      })

      let toolIdMap: Record<string, string> = {}

      const flushPendingOperationEvents = async function* () {
        while (pendingOperationEvents.length > 0) {
          const event = pendingOperationEvents.shift()
          if (event) {
            yield event
          }
        }
      }

      for await (const chunk of response.fullStream) {
        yield* flushPendingOperationEvents()

        switch (chunk.type) {
          case 'reasoning-delta':
            yield {
              type: 'reasoning_delta',
              runId,
              text: chunk.text, 
              stepId
            }
            break

          case 'text-delta':
            yield {
              type: 'text_delta',
              runId,
              text: chunk.text, 
              stepId
            }
            break

          case 'tool-call':
            yield {
              type: 'tool_call',
              runId,
              metadata:{
                toolName: chunk.toolName,
                toolId: chunk.toolCallId,
                args: chunk.input,
              },
              stepId
            }
            break

          case 'tool-input-start':
            // Send notification
            toolIdMap[chunk.id] = chunk.toolName
            if(chunk.toolName === 'editContent' || chunk.toolName === 'todoWrite'){
              yield {
                type: 'tool_call_start',
                runId,
                metadata:{
                  toolName: chunk.toolName,
                  toolId: chunk.id,
                  args: ''
                },
                stepId
              }
            }
            break;

          case 'tool-input-delta':
            if(chunk.id in toolIdMap){
              yield {
                type: 'tool_call_delta',
                runId,
                metadata:{
                  toolName: toolIdMap[chunk.id],
                  toolId: chunk.id,
                  args: chunk.delta
                },
                stepId
              }

            }
            break;

          case 'tool-input-end':
            if (chunk.id in toolIdMap) {
              yield {
                type: 'tool_call_end',
                runId,
                metadata: {
                  toolName: toolIdMap[chunk.id],
                  toolId: chunk.id,
                  args: '',
                },
                stepId,
              }
              delete toolIdMap[chunk.id]
            }
            break;

          case 'error':
            yield {
              type: 'error',
              runId,
              text: chunk.error instanceof Error ? chunk.error.message : String(chunk.error),
            }
            break
        }
      }

      yield* flushPendingOperationEvents()

      if (!didAbort && !didError) {
        await onSuccess({
          success: true,
          response: finalResponse,
          toolsUsed: Array.from(toolsUsed),
          tokensUsed: this.usage.totalTokens,
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (abortSignal.aborted) {
        if (!didAbort) {
          didAbort = true
          await this.updateRun(runId, {finishReason: 'aborted'})
          await onAbort()
        }
      } else {
        if (!didError) {
          didError = true
          await this.updateRun(runId, {finishReason: 'error', error: errorMessage})
          await onError(error instanceof Error ? error : new Error(errorMessage))
        }
        yield {
          type: 'error', 
          runId,
          text: errorMessage
        }
      }
    } finally {
      yield { type: 'end', runId }
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
