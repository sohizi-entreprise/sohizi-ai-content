import { createOpenAI } from '@ai-sdk/openai'
import { stepCountIs, streamText } from 'ai'

import { skillRegistry } from '../editor-agent/skill-registry'
import type { WriterAgentConfig, SubAgentResult } from './types'
import { getContentWriterPrompt } from '../../prompts/content-writer'
import { readContent } from '../editor-agent/tools'
import { WriterPhase } from '../editor-agent'
import { v4 as uuidv4 } from 'uuid'


// ============================================================================
// WRITER AGENT
// ============================================================================

export class WriterAgent {
  private config: WriterAgentConfig

  constructor(config: WriterAgentConfig) {
    this.config = config
  }

  async run(runId:string): Promise<SubAgentResult> {
    const { instruction, skillset } = this.config
    let totalTokens = 0

    try {
      const skillsContent = skillRegistry.getSkillsContent(skillset)

      if (this.config.abortSignal?.aborted) {
        return {
          success: false,
          error: 'Operation cancelled',
          tokensUsed: totalTokens
        }
      }

      // Phase 1: Write content (streaming)
      const [content, writeTokensUsed] = await this.write(instruction, skillsContent, runId)
      totalTokens += writeTokensUsed

      return {
        success: true,
        response: content,
        tokensUsed: totalTokens,
      }
    } catch (error) {
      return {
        success: false,
        error: `Error: ${error instanceof Error ? error.message : String(error)}`,
        tokensUsed: totalTokens,
      }
    }
  }

  private async write(
    instruction: string,
    skillsContent: string,
    runId: string
  ): Promise<[string, number]> {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const systemPrompt = getContentWriterPrompt({project: this.config.project, skills: skillsContent})
    const userPrompt = `OPERATION: ${JSON.stringify(this.config.operation)}\n---\n${instruction}`
    let tokensUsed = 0

    let stepId = uuidv4()

    try {
      const response = streamText({
        model: openai('gpt-5-mini'),
        system: systemPrompt,
        prompt: userPrompt,
        tools: {readContent},
        abortSignal: this.config.abortSignal,
        stopWhen: stepCountIs(25),
        onStepFinish: ()=>{
          stepId = uuidv4()
        },
        onFinish({totalUsage}){
          tokensUsed += totalUsage.totalTokens || 0
        }
      })
  
      let content = ''
      this.emitProgress('writing_start', runId)
  
      for await (const chunk of response.textStream) {
        content += chunk
        this.emitProgress('writing_delta', runId, {text: chunk, stepId})
      }
  
      return [content.trim(), tokensUsed]
      
    } catch (error) {
      if(tokensUsed > 0){
        return ['', tokensUsed]
      }
      throw new Error(`Error occurred while writing content: ${error instanceof Error ? error.message : String(error)}`)
    }
    finally{
      this.emitProgress('writing_end', runId)
    }
  }

  private emitProgress(type: WriterPhase, runId: string, data?: Record<string, unknown>): void {
    this.config.stream.push({
      type: 'content_edit',
      data: {
        runId,
        type,
        ...data
      }
    })
  }
}
