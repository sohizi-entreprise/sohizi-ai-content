import { z } from 'zod'
import { tool } from 'ai'

import { skillRegistry } from './skill-registry'
import { WriterAgent } from '../sub-agents/writer-agent'
import { SubAgent } from '../sub-agents/sub-agent'
import type { StoryBibleEntityType } from '@/type'
import type { RunContext } from './types'
import {
  formatEntityDefinition,
  formatOutlineAsText,
  formatSearchResultsAsText,
  formatStoryBibleOutline,
  getBlockContext,
  getEntityDefinition as getEntityDefinitionFromIndex,
  getOutline,
  search,
} from './document-index'


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
  blockType: z.string().describe('The type of the block to insert.'),
  content: z.string().describe('The new block content in plain text. No markdown.'),
  insertAfterBlockId: z.string().describe('ID of the block to insert the new content after.'),
})

export const deleteOperation = z.object({
  type: z.literal('delete'),
  blockId: z.string().describe('ID of the block/selection to delete.'),
  content: z.string().describe('Leave it empty.').default(''),
})

export const updateOperation = z.object({
  type: z.literal('update'),
  blockId: z.string().describe('ID of the block/selection to update. MUST keep the original "id" for consistency.'),
  content: z.string().describe('The new content of the block/selection in plain text. No markdown'),
})

// export const editContentSchema = z.object({
//   instruction: z.string().describe('Clear instruction on what to write or how to update the content.'),
//   skillset: z.array(z.string()).describe('Skills to load for this writing task (e.g., ["synopsis", "narrative_arc"])'),
//   operation: z.union([insertOperation, deleteOperation, updateOperation]).describe('The operation to perform on the script content.'),
// })

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
  inputSchema: z.object({
    operation: z.union([insertOperation, deleteOperation, updateOperation]).describe('The editing operation to perform on the script content.'),
  }),
  outputSchema: outputSchema,
  execute: async ({operation}, {experimental_context}) => {
    const {documentIndex} = experimental_context as RunContext

    // Validates in the block exist for 

    switch (operation.type) {
      case 'insert':
        if(!documentIndex.byId.get(operation.insertAfterBlockId)) {
          return { success: false, text: `insertAfterBlockId ${operation.insertAfterBlockId} does not exist.` }
        }
        break
      case 'delete':
        if(!documentIndex.byId.get(operation.blockId)) {
          return { success: false, text: `Block or Selection with ID ${operation.blockId} does not exist.` }
        }
        break
      case 'update':
        if(!documentIndex.byId.get(operation.blockId)) {
          return { success: false, text: `Block or Selection with ID ${operation.blockId} does not exist.` }
        }
        break
    }

    return { success: true, text: 'Editing operation completed successfully.' }

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
// READ TOOLS
// ============================================================================
const documentId = z.enum(['synopsis', 'script', 'story_bible']).describe('The ID of the document to search.')

export const getDocumentOutline = tool({
  description: `Returns a lightweight structural outline of the entire document without fetching block content.
  It gives you block IDs, types, labels, and hierarchy so you can plan targeted reads instead of scanning blindly. 
  Think of it as the table of contents for the active editor.
  `,
  inputSchema: z.object({
    documentId,
  }),
  outputSchema: outputSchema,
  execute: async ({ documentId }, { experimental_context }) => {
    const runContext = experimental_context as RunContext
    const { documentIndex, project } = runContext
    let text: string
    if (documentId === 'story_bible') {
      text = formatStoryBibleOutline(project.story_bible as Parameters<typeof formatStoryBibleOutline>[0])
    } else {
      const nodes = getOutline(documentIndex, documentId as 'synopsis' | 'script')
      text = formatOutlineAsText(nodes)
    }
    return { success: true, text }
  },
})

export const searchDocument = tool({
  description: `Searches for specific keywords, phrases, or entity names across the workspace.
  Returns the block IDs and a short text snippet of the matches. Use this to find references to a prop, location, or character without reading the whole document.
  `,
  inputSchema: z.object({
    documentIds: z.array(documentId).describe('Optional. An array of document IDs to restrict the search to. If empty, searches all available documents.'),
    query: z.string().describe('The specific text, character name, or keyword to search for.'),
  }),
  outputSchema: outputSchema,
  execute: async ({ documentIds, query }, { experimental_context }) => {
    const runContext = experimental_context as RunContext
    const matches = search(
      runContext.documentIndex,
      documentIds as ('synopsis' | 'script' | 'story_bible')[],
      query
    )
    const text = formatSearchResultsAsText(matches)
    return { success: true, text }
  },
})

export const readBlockContext = tool({
  description: `Reads the content of a specific block in the document by its block ID.
  Use this to get the block's content, type, and ID. Use when you need to read a block (or a user-selected snippet identified by blockId) before suggesting edits.`,
  inputSchema: z.object({
    blockId: z.string().describe('The block ID (block or contextAnchor snippet) to read.'),
  }),
  outputSchema: outputSchema,
  execute: async ({ blockId }, { experimental_context }) => {
    const runContext = experimental_context as RunContext
    const text = getBlockContext(runContext.documentIndex, blockId)
    return { success: true, text }
  },
})

export const getEntityDefinition = tool({
  description: `Fetches the canonical definition blocks for a character, location, or prop from the world editor. 
  Use this when reasoning about a screenplay or synopsis edit that involves an entity — to verify consistency with established traits, backstory, or physical description before suggesting changes. 
  Avoids cross-editor confusion by always pulling the ground truth from the world editor..
  `,
  inputSchema: z.object({
    entityId: z.string().describe('The ID of the entity to get the definition of.'),
    entityType: z.enum(['character', 'location', 'prop']).describe('The type of the entity to get the definition of.'),
  }),
  outputSchema: outputSchema,
  execute: async ({ entityId, entityType }, { experimental_context }) => {
    const runContext = experimental_context as RunContext
    const project = runContext.project
    const entity = getEntityDefinitionFromIndex(
      project,
      entityId,
      entityType as StoryBibleEntityType
    )
    const text = formatEntityDefinition(entity, entityType as StoryBibleEntityType)
    return { success: !!entity, text }
  },
})
