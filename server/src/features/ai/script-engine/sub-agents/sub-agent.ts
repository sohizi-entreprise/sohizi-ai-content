import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import { skillRegistry } from '../editor-agent/skill-registry'
import type { SubAgentConfig, SubAgentResult } from './types'
import { v4 as uuidv4 } from 'uuid'

// ============================================================================
// FLEXIBLE SUB-AGENT
// ============================================================================

/**
 * SubAgent - Flexible sub-agent for custom tasks
 * 
 * Can handle any task by following the provided instruction with loaded skills.
 * Tasks include: research, summarization, analysis, brainstorming, etc.
 * 
 * Workflow:
 * 1. Load provided skillset
 * 2. Execute instruction with context
 * 3. Self-review output against instruction
 * 4. Return structured result
 */
export class SubAgent {
  private config: SubAgentConfig

  constructor(config: SubAgentConfig) {
    this.config = config
  }

  /**
   * Run the sub-agent
   */
  async run(): Promise<SubAgentResult> {
    const { instruction, skillset, expectedOutput } = this.config
    let totalTokens = 0

    try {
      // Load skills
      const skillsContent = skillRegistry.getSkillsContent(skillset)

      // Build and execute the task prompt
      const taskPrompt = this.buildTaskPrompt(instruction, skillsContent, expectedOutput)
      const [response, tokensUsed] = await this.executeTask(taskPrompt)
      totalTokens += tokensUsed

      return {
        success: true,
        response: response,
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
   * Build the task prompt
   */
  private buildTaskPrompt(
    instruction: string,
    skillsContent: string,
    expectedOutput: SubAgentConfig['expectedOutput']
  ): string {
    // TODO build prompt
    let prompt = ''

    return prompt
  }

  /**
   * Execute the task
   */
  private async executeTask(prompt: string): Promise<[string, number]> {
    const openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    const model = this.config.complexity === 'simple' ? 'gpt-4.1-mini' : 'gpt-5-mini'

    const result = await generateText({
      model: openai(model),
      prompt,
      abortSignal: this.config.abortSignal,
    })

    const totalTokens = result.usage.totalTokens || 0

    return [result.text.trim(), totalTokens]
  }
}
