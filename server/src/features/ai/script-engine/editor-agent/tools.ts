import { z } from 'zod'
import { tool } from 'ai'

import { skillRegistry } from './skill-registry'
import { WriterAgent } from '../sub-agents/writer-agent'
import { SubAgent } from '../sub-agents/sub-agent'
import type { RunContext } from './types'


// ============================================================================
// TOOL SCHEMAS
// ============================================================================

export const readContentSchema = z.object({
  component: z.enum(['synopsis', 'script']).describe('Which component to read.'),
  blockIds: z.array(z.string()).describe('IDs of blocks to read. If empty, it reads the entire component which can be verbose.'),
  offset: z.number().describe('How many additional blocks to read before and after each target component.'),
})

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

export const insertOperation = z.object({
  type: z.literal('insert'),
  insertAfterBlockId: z.string().describe('ID of the block to insert the new content after.'),
})

export const deleteOperation = z.object({
  type: z.literal('delete'),
  blockId: z.string().describe('ID of the block to delete.'),
})

export const updateOperation = z.object({
  type: z.literal('update'),
  blockId: z.string().describe('ID of the block to update.'),
})

export const editContentSchema = z.object({
  instruction: z.string().describe('Clear instruction on what to write or how to update the content.'),
  skillset: z.array(z.string()).describe('Skills to load for this writing task (e.g., ["synopsis", "narrative_arc"])'),
  operation: z.union([insertOperation, deleteOperation, updateOperation]).describe('The operation to perform on the script content.'),
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

export const outputSchema = z.object({
  success: z.boolean(),
  text: z.string(),
})


// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Read current editor content from the database
 */
export const readContent = tool({
  description: `Retrieves the current text content and Block IDs from the editor.
CRITICAL RULE: You MUST use this tool FIRST before making any edits or writing new content to ensure you understand the existing narrative context and story flow.
Parameters:
- component (String, Enum): [REQUIRED] Specifies which part of the project to read. For example: 'synopsis' or 'script'.
- blockIds (Array of Strings): The specific Block IDs you want to read. WARNING: Leaving this empty retrieves the entire component, which is highly verbose and consumes massive context. Always specify target IDs unless a full read is absolutely necessary.
- offset (Integer): The number of surrounding blocks to fetch before and after each requested blockId. (e.g., An offset of 2 returns the target block plus the 2 blocks before it and the 2 blocks after it). Always use a small offset (e.g., 1 to 3) to understand the surrounding context and maintain story flow consistency.
`,
  inputSchema: readContentSchema,
  outputSchema: outputSchema,
  execute: async ({ component, blockIds, offset }, { experimental_context }) => {
    const runContext = experimental_context as RunContext
    const project = runContext.project

    const allBlocks = getBlocksForComponent(project, component)
    if (allBlocks.length === 0) {
      return { success: true, text: formatBlocksAsText([], component) }
    }

    const indices = selectBlockIndicesWithOffset(allBlocks, blockIds, offset)
    const selectedBlocks = indices.map((i) => allBlocks[i])
    const text = formatBlocksAsText(selectedBlocks, component)
    return { success: true, text }
  },
})

/**
 * Load a skill's full content into context
 */
export const loadSkills = tool({
  description: 'Load a skill to gain knowledge about a specific technique. You MUST load relevant skills before performing related actions.',
  inputSchema: loadSkillSchema,
  outputSchema: outputSchema,
  execute: async ({ skills }) => {
    const content = skillRegistry.getSkillsContent(skills)

    if (!content) {
      return { success: false, 
               text: `Failed to load skills: The names you provided are not valid skills. Available skills: ${skillRegistry.getSkillNames().join(', ')}` 
              }
    }

    return { success: true, text: `<loaded_skills>\n${content}\n</loaded_skills>` }
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
  outputSchema: outputSchema,
  execute: async ({ items }) => {
  
    const STATUS_ICONS: Record<string, string> = {
      pending: '⏳',
      in_progress: '🔄',
      done: '✅',
    }

    const validatedItems: TodoItem[] = items.map((item) => ({
      id: item.id,
      task: item.task,
      status: ['pending', 'in_progress', 'done'].includes(item.status) ? item.status : 'pending',
    }))

    let pendingCount = 0
    let inProgressCount = 0
    let doneCount = 0

    for (const item of validatedItems) {
      if (item.status === 'pending') pendingCount++
      else if (item.status === 'in_progress') inProgressCount++
      else if (item.status === 'done') doneCount++
    }

    const summaryLines: string[] = ['Todo list updated:']

    validatedItems.forEach((item, idx) => {
      const icon = STATUS_ICONS[item.status] || '❓'
      summaryLines.push(`  ${idx + 1}. [${icon}] ${item.task} (${item.status})`)
    })

    summaryLines.push(`\nProgress: ${doneCount}/${validatedItems.length} tasks completed`)

    if (inProgressCount > 1) {
      summaryLines.push('⚠️ Warning: Multiple tasks are in_progress. Focus on one task at a time.')
    }

    let nextTask: string | null = null

    for (const item of validatedItems) {
      if (item.status === 'in_progress') {
        nextTask = item.task
        break
      }
    }

    if (!nextTask) {
      for (const item of validatedItems) {
        if (item.status === 'pending') {
          nextTask = item.task
          summaryLines.push(`\n→ Next task to start: ${nextTask}`)
          break
        }
      }
    }

    if (!nextTask && doneCount === validatedItems.length) {
      summaryLines.push('\n✅ All tasks completed!')
    }

    return { success: true, text: summaryLines.join('\n') }
  },
})

/**
 * Write or update content - spawns WriterAgent sub-agent, computes diff, and streams it to client
 */
export const editContent = tool({
  description: `Delegates script writing and editing to this tool. Use this tool to write new content (e.g., titles, synopsis paragraphs), update existing blocks, or restructure sections.
CRITICAL REQUIREMENTS:
- Block IDs: You MUST explicitly include the exact Block IDs or selection identifiers to be edited within your instruction.
- Clear Instructions: Provide highly specific directions detailing exactly what the sub-agent needs to write or change.
- Skills: Select and pass the relevant skills the tool will need.
Note: The tool will generate the new content and submit it directly to the user's editor for human review (accept/reject).
`,
  inputSchema: editContentSchema,
  outputSchema: outputSchema,
  execute: async ({ instruction, skillset, operation }, {abortSignal, experimental_context}) => {
    const runContext = experimental_context as RunContext

    const writerAgent = new WriterAgent({
      instruction,
      skillset,
      operation,
      project: runContext.project,
      stream: runContext.stream,
      abortSignal: abortSignal,
    })

    const result = await writerAgent.run(runContext.runId)

    if (!result.success) {
      return { success: false, text: 'error' in result ? result.error : 'Writer agent failed' }
    }
    return { success: true, text: 'New content written and sent to editor.' }

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
  outputSchema: outputSchema,
  execute: async ({ instruction, skillset, expectedOutput, complexity }, {abortSignal}) => {

    const subAgent = new SubAgent({
      instruction,
      skillset,
      expectedOutput,
      complexity,
      abortSignal: abortSignal,
    })

    const {tokensUsed, ...result} = await subAgent.run()

    return { success: result.success, text: result.success ? result.response : result.error }

  },
})

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type ProseNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: Array<{ type: 'text'; text?: string } | ProseNode>
  text?: string
}
type ProseDocument = { type: 'doc'; content: ProseNode[] }

type ContentBlock = { id: string; type: string; content: string; order: number }

function extractTextFromProseNode(node: ProseNode): string {
  if (typeof node.text === 'string') return node.text
  if (!Array.isArray(node.content)) return ''
  return node.content
    .map((c) => (c && typeof c === 'object' && 'text' in c ? (c as { text?: string }).text ?? '' : extractTextFromProseNode(c as ProseNode)))
    .join('')
}

function getBlocksFromProseDocument(doc: ProseDocument | null): ContentBlock[] {
  if (!doc || doc.type !== 'doc' || !Array.isArray(doc.content)) return []
  const blocks: ContentBlock[] = []
  doc.content.forEach((node, order) => {
    const id = (node.attrs?.blockId ?? node.attrs?.id) as string | undefined
    if (id == null && (node.type === 'synopsisSpacer' || node.type === 'synopsisDivider')) return
    const blockId = id ?? `_order_${order}`
    const content = extractTextFromProseNode(node).trim()
    blocks.push({ id: blockId, type: node.type, content, order })
  })
  return blocks
}

function getBlocksFromSynopsis(synopsis: unknown): ContentBlock[] {
  if (!synopsis) return []
  const doc = synopsis as { type?: string; content?: ProseNode[] }
  if (doc.type === 'doc' && Array.isArray(doc.content)) return getBlocksFromProseDocument(doc as ProseDocument)
  const legacy = synopsis as { title?: string; text?: string }
  const title = legacy.title ?? 'Untitled'
  const text = legacy.text ?? ''
  const blocks: ContentBlock[] = []
  if (title) blocks.push({ id: 'title', type: 'synopsisTitle', content: title, order: 0 })
  if (text) blocks.push({ id: 'body', type: 'synopsisContent', content: text, order: 1 })
  return blocks
}

function getBlocksForComponent(project: RunContext['project'], component: 'synopsis' | 'script'): ContentBlock[] {
  if (component === 'script') return getBlocksFromProseDocument(project.script as ProseDocument | null)
  return getBlocksFromSynopsis(project.synopsis)
}

function selectBlockIndicesWithOffset(blocks: ContentBlock[], blockIds: string[], offset: number): number[] {
  if (blockIds.length === 0) return blocks.map((_, i) => i)
  const idToIndex = new Map(blocks.map((b, i) => [b.id, i]))
  const indices = new Set<number>()
  for (const id of blockIds) {
    const i = idToIndex.get(id)
    if (i == null) continue
    for (let k = Math.max(0, i - offset); k <= Math.min(blocks.length - 1, i + offset); k++) indices.add(k)
  }
  return [...indices].sort((a, b) => a - b)
}

function formatBlocksAsText(blocks: ContentBlock[], component: 'synopsis' | 'script'): string {
  if (blocks.length === 0) return `[${component}: no content]`
  const lines = blocks.map((b) => `[id=${b.id} type=${b.type}]\n${b.content || '(empty)'}`)
  return `<${component}>\n${lines.join('\n\n')}\n</${component}>`
}
