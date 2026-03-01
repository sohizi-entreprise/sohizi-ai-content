import { createOpenAI } from '@ai-sdk/openai'
import { generateText, Output, streamText } from 'ai'

import { skillRegistry } from '../editor-agent/skill-registry'
import type { WriterAgentConfig, ReviewResult, WriterPhase, SubAgentResult } from './types'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const ReviewOutputSchema = z.object({
  approved: z.boolean().describe('Whether the content passes review'),
  feedback: z.array(z.string()).describe('If the content is NOT APPROVED (approved: false) - provide a list of things that need to be fixed. Otherwise, leave an empty list.'),
})

// ============================================================================
// WRITER AGENT
// ============================================================================

export class WriterAgent {
  private config: WriterAgentConfig

  constructor(config: WriterAgentConfig) {
    this.config = config
  }

  /**
   * Run the writer agent
   */
  async run(): Promise<SubAgentResult> {
    const { instruction, skillset, context } = this.config
    const runId = uuidv4()
    let totalTokens = 0

    try {
      // Load skills
      const skillsContent = skillRegistry.getSkillsContent(skillset)

      // Phase 1: Write content (streaming)
      const [content, writeTokensUsed] = await this.write(instruction, skillsContent, context, runId)
      totalTokens += writeTokensUsed

      if (this.config.abortSignal?.aborted) {
        throw new Error('Operation cancelled')
      }

      // Phase 2: Review content (single pass, no streaming)
      const reviewSkill = skillRegistry.getSkillContent('review') || ''
      const [review, reviewTokensUsed] = await this.review(content, instruction, reviewSkill, context, runId)
      totalTokens += reviewTokensUsed

      if (!review.approved){
        const newContext = 'REVIEW: .....'
        await this.write(instruction, skillsContent, newContext, runId)
        return {
          success: true,
          response: "Content written successfully. It is sent to the text editor where it will be visible.",
          tokensUsed: totalTokens,
        }
      }

      return {
        success: true,
        response: "Content written successfully. It is sent to the text editor where it will be visible.",
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

  /**
   * Write content using streaming
   */
  private async write(
    instruction: string,
    skillsContent: string,
    context: string,
    runId: string
  ): Promise<[string, number]> {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const prompt = this.buildWritePrompt(instruction, skillsContent, context)
    let tokensUsed = 0

    try {
      const response = streamText({
        model: openai('gpt-5-mini'),
        prompt,
        abortSignal: this.config.abortSignal,
        onFinish({totalUsage}){
          tokensUsed += totalUsage.totalTokens || 0
        }
      })
  
      let content = ''
      this.emitProgress('writing_start', runId)
  
      for await (const chunk of response.textStream) {
        content += chunk
  
        // Emit streaming delta
        this.emitProgress('writing_delta', runId, chunk)
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

  /**
   * Review content (single pass, no streaming)
   */
  private async review(
    content: string,
    originalInstruction: string,
    reviewSkill: string,
    context: WriterAgentConfig['context'],
    runId: string
  ): Promise<[ReviewResult, number]> {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const prompt = this.buildReviewPrompt(content, originalInstruction, reviewSkill, context)
    let tokensUsed = 0
  
    try {
      this.emitProgress('reviewing_start', runId)
      const result = await generateText({
        model: openai('gpt-5-mini'),
        prompt,
        abortSignal: this.config.abortSignal,
        output: Output.object({schema: ReviewOutputSchema})
      })
      tokensUsed += result.usage.totalTokens || 0

      return [result.output, tokensUsed]

    } catch (error) {
      if(tokensUsed > 0){
        return [{ approved: true, feedback: [] }, tokensUsed]
      }
      throw new Error(`Error occurred while reviewing content: ${error instanceof Error ? error.message : String(error)}`)
    }
    finally{
      this.emitProgress('reviewing_end', runId)
    }

  }

  /**
   * Build the write prompt
   */
  private buildWritePrompt(
    instruction: string,
    skillsContent: string,
    context: string
  ): string {
    // identity + skillset + memory_context + working_context
    // Also build the user prompt
    let prompt = ""

    return prompt
  }

  /**
   * Build the review prompt
   */
  private buildReviewPrompt(
    content: string,
    originalInstruction: string,
    reviewSkill: string,
    context: WriterAgentConfig['context']
  ): string {
    let prompt = ""

    return prompt
  }

  /**
   * Emit progress event
   */
  private emitProgress(type: WriterPhase, runId: string, content: string = ''): void {
    this.config.streamBus.push({
      type: 'content_editing',
      data: {
        runId,
        type,
        content,
      }
    })
  }
}
