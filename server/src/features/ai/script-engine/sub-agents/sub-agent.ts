import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

import { skillRegistry } from '../editor-agent/skill-registry'
import type { SubAgentConfig, SubAgentResult } from './types'

// ============================================================================
// FLEXIBLE SUB-AGENT
// ============================================================================

export class SubAgent {
  private config: SubAgentConfig

  constructor(config: SubAgentConfig) {
    this.config = config
  }

  async run(): Promise<SubAgentResult> {
    const { instruction, skillset, expectedOutput } = this.config
    let totalTokens = 0

    try {
      const skillsContent = skillRegistry.getSkillsContent(skillset)
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

  private buildTaskPrompt(
    instruction: string,
    skillsContent: string,
    expectedOutput: SubAgentConfig['expectedOutput']
  ): string {
    return `<identity>
You are a focused sub-agent specialized in script analysis and creative tasks for video production.
Execute the given task precisely and return your output in the requested format.
</identity>

${skillsContent ? `<skills>\n${skillsContent}\n</skills>` : ''}

<task>
${instruction}
</task>

<output_format>
Format: ${expectedOutput.format}
${expectedOutput.description}
${expectedOutput.format === 'json' ? '\nReturn ONLY valid JSON. No markdown code fences or explanation.' : ''}
</output_format>`
  }

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
