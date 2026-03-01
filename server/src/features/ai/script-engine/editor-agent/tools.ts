import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { tool } from 'ai'

import { skillRegistry } from './skill-registry'
import { WriterAgent } from '../sub-agents/writer-agent'
import { SubAgent } from '../sub-agents/sub-agent'
import type { RunContext } from './types'

// ============================================================================
// TOOL SCHEMAS
// ============================================================================

export const loadSkillSchema = z.object({
  skills: z.array(z.string()).describe('The names of the skills to load (e.g., ["scene_writing", "dialogue_craft"])'),
})

export const todoItemSchema = z.object({
  id: z.string().describe('Unique identifier for the task. e.g. "task_1", "task_2"'),
  task: z.string().describe('A concise, verb-first task description. e.g. "Write the title block", "Update the entry hook block"'),
  status: z.enum(['pending', 'in_progress', 'done']).describe('Task status: pending (not started), in_progress (currently working), done (completed)'),
})

export type TodoItem = z.infer<typeof todoItemSchema>

export const todoWriteSchema = z.object({
  items: z.array(todoItemSchema).describe('List of todo items to create or update. Pass multiple items to update statuses simultaneously.'),
})

export const editContentSchema = z.object({
  instruction: z.string().describe('Clear instruction on what to write or how to update'),
  skillset: z.array(z.string()).describe('Skills to load for this writing task (e.g., ["scene_writing", "dialogue_craft"])'),
})

export const deleteContentSchema = z.object({
  blockIds: z.array(z.string()).describe('IDs of blocks to delete'),
})

export const spawnTaskSchema = z.object({
  instruction: z.string().describe('Clear instruction on what the sub-agent should do'),
  skillset: z.array(z.string()).describe('List of skills to load for this task to help the sub-agent perform the assigned task.'),
  expectedOutput: z.object({
    format: z.enum(['text', 'json']).describe('Expected output format'),
    description: z.string().describe('Description of the expected output format. Either text or json. If json, describe the schema of the expected output using a valid JSON schema (without markdown code blocks).'),
  }),
  complexity: z.enum(['simple', 'complex']).default('simple').describe('Use "complex" for multi-step reasoning or critical analysis'),
})


// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Load a skill's full content into context
 */
export const loadSkills = tool({
  description: 'Load a skill to gain knowledge about a specific technique. You MUST load relevant skills before performing related actions.',
  inputSchema: loadSkillSchema,
  execute: async ({ skills }) => {
    const content = skillRegistry.getSkillsContent(skills)

    if (!content) {
      return `Failed to load skills: The names you provided are not valid skills. Available skills: ${skillRegistry.getSkillNames().join(', ')}`
    }

    return `<loaded_skills>\n${content}\n</loaded_skills>`
  },
})

/**
 * Manage task list for tracking progress on complex multi-step tasks.
 */
export const todoWrite = tool({
  description: `Creates or updates a todo list for tracking complex multi-step tasks.
Use when the user's request requires 3+ steps or when they provide a list of tasks.
Not needed for straightforward or conversational requests (< 3 steps).

Call this tool to:
1. Create an initial todo list breaking down a complex task into steps
2. Update a task's status to 'in_progress' when starting it
3. Update a task's status to 'done' when completed

Pass multiple items to update statuses simultaneously when possible.`,
  inputSchema: todoWriteSchema,
  execute: async ({ items }, {experimental_context}) => {
    const runContext = experimental_context as RunContext
  
    const STATUS_ICONS: Record<string, string> = {
      pending: '⏳',
      in_progress: '🔄',
      done: '✅',
    }

    // Validate and normalize items
    const validatedItems: TodoItem[] = items.map((item) => ({
      id: item.id,
      task: item.task,
      status: ['pending', 'in_progress', 'done'].includes(item.status) ? item.status : 'pending',
    }))

    // Emit todo list event
    runContext.streamBus.push({
      type: 'progress_update',
      data: {
        runId: uuidv4(),
        type: 'todo',
        content: JSON.stringify(validatedItems),
      },
    })

    // Count statuses
    let pendingCount = 0
    let inProgressCount = 0
    let doneCount = 0

    for (const item of validatedItems) {
      if (item.status === 'pending') pendingCount++
      else if (item.status === 'in_progress') inProgressCount++
      else if (item.status === 'done') doneCount++
    }

    // Build summary
    const summaryLines: string[] = ['Todo list updated:']

    validatedItems.forEach((item, idx) => {
      const icon = STATUS_ICONS[item.status] || '❓'
      summaryLines.push(`  ${idx + 1}. [${icon}] ${item.task} (${item.status})`)
    })

    summaryLines.push(`\nProgress: ${doneCount}/${validatedItems.length} tasks completed`)

    // Warn if multiple tasks are in_progress
    if (inProgressCount > 1) {
      summaryLines.push('⚠️ Warning: Multiple tasks are in_progress. Focus on one task at a time.')
    }

    // Find next task to work on
    let nextTask: string | null = null

    // First, check for any in_progress task
    for (const item of validatedItems) {
      if (item.status === 'in_progress') {
        nextTask = item.task
        break
      }
    }

    // If no in_progress, find next pending task
    if (!nextTask) {
      for (const item of validatedItems) {
        if (item.status === 'pending') {
          nextTask = item.task
          summaryLines.push(`\n→ Next task to start: ${nextTask}`)
          break
        }
      }
    }

    // Check if all tasks are completed
    if (!nextTask && doneCount === validatedItems.length) {
      summaryLines.push('\n✅ All tasks completed!')
    }

    const response = summaryLines.join('\n')

    return response
  },
})

/**
 * Write or update content - spawns WriterAgent sub-agent
 */
export const editContent = tool({
  description: `Modifies content in the script editor. Use this tool when the user wants to:
- Write new content (scenes, dialogue, descriptions, etc.)
- Update an existing block of content
- Delete or remove content

Provide a clear, specific instruction describing what to write or change, and select relevant skills to guide the writing style.`,
  inputSchema: editContentSchema,
  execute: async ({ instruction, skillset }, {abortSignal, experimental_context}) => {
    const runContext = experimental_context as RunContext

    const writerAgent = new WriterAgent({
      instruction,
      skillset,
      // TODO: Build the context
      context: "TODO: Build the context",
      streamBus: runContext.streamBus,
      abortSignal: abortSignal,
    })

    const {tokensUsed, ...result} = await writerAgent.run()
    // TODO track tokens used
    return result
  },
})

/**
 * Delegate a task to a specialized sub-agent
 */
export const delegateTask = tool({
  description: `Delegates a task to a focused sub-agent. Use this to offload work that requires deep attention or would consume too much of your context.

**When to delegate:**
- Analysis tasks (themes, structure, quality evaluation)
- Research or information gathering
- Summarization of lengthy content
- Brainstorming or generating alternatives
- Any task requiring focused reasoning without distraction

**Complexity setting:**
- "simple" (default): Summarization, brainstorming, basic pattern extraction
- "complex": Plot consistency checks, critical decisions, multi-step logical reasoning

Provide a clear instruction, relevant skills, and specify the expected output format (text or JSON).`,
  inputSchema: spawnTaskSchema,
  execute: async ({ instruction, skillset, expectedOutput, complexity }, {abortSignal}) => {

    const subAgent = new SubAgent({
      instruction,
      skillset,
      expectedOutput,
      complexity,
      abortSignal: abortSignal,
    })

    const {tokensUsed, ...result} = await subAgent.run()

    return result

  },
})
