import { z } from 'zod'
import { tool } from 'ai'

import { storyBibleToProseDoc } from '@/utils/world-sync-engine'
import { skillRegistry } from './skill-registry'
import type { RunContext } from './types'
import {
  createOperationsResult,
  getBlockSchema,
  getEditorOperationsPayload,
  getEntityDetail,
  getEntityOutline,
  getEntityProseDoc,
  getProjectRequirements,
  getSceneById,
  getSceneNode,
  getScreenplayOutline,
  getStoryBible,
  getSynopsis,
  searchScreenplay as searchScreenplayInProject,
  synopsisToProseDoc,
} from './utils'
import {
  CharacterSchema,
  LocationSchema,
  PropSchema,
  editorOperationListSchema,
  sceneContentSchema,
  storyBibleSchema,
  synopsisSchema,
  type StoryBible,
} from 'zSchemas'


// ============================================================================
// TOOL SCHEMAS
// ============================================================================

export const readContentSchema = z.object({
  component: z.enum(['synopsis', 'script']).describe('Which component to read.'),
  blockIds: z.array(z.string()).describe('IDs of blocks to read. If empty, it reads the entire component which can be verbose.'),
  offset: z.number().describe('How many additional blocks to read before and after each target component.'),
})

export const readScreenplayOutlineSchema = z.object({})

export const readProjectRequirementsSchema = z.object({})

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

export const mutationToolOutputSchema = outputSchema.extend({
  documentId: z.string().optional(),
  operations: editorOperationListSchema.optional(),
})

const storyComponentSchema = z.discriminatedUnion('component', [
  z.object({
    component: z.literal('synopsis'),
    content: synopsisSchema.describe('The full synopsis content to replace the current synopsis with.'),
  }),
  z.object({
    component: z.literal('story_bible'),
    content: storyBibleSchema.describe('The full story bible content to replace the current story bible with.'),
  }),
])

const projectComponentSchema = z.discriminatedUnion('component', [
  z.object({
    component: z.literal('scene'),
    componentId: z.string().describe('The id of the existing scene to rewrite.'),
    content: sceneContentSchema.describe('The full replacement scene content.'),
  }),
  z.object({
    component: z.literal('character'),
    componentId: z.string().describe('The id of the existing character to rewrite.'),
    content: CharacterSchema.describe('The full replacement character content.'),
  }),
  z.object({
    component: z.literal('location'),
    componentId: z.string().describe('The id of the existing location to rewrite.'),
    content: LocationSchema.describe('The full replacement location content.'),
  }),
  z.object({
    component: z.literal('prop'),
    componentId: z.string().describe('The id of the existing prop to rewrite.'),
    content: PropSchema.describe('The full replacement prop content.'),
  }),
])

const entityCreateSchema = z.discriminatedUnion('component', [
  z.object({
    component: z.literal('character'),
    content: CharacterSchema.describe('The full content for the new character.'),
  }),
  z.object({
    component: z.literal('location'),
    content: LocationSchema.describe('The full content for the new location.'),
  }),
  z.object({
    component: z.literal('prop'),
    content: PropSchema.describe('The full content for the new prop.'),
  }),
])

const scenePlacementSchema = z.object({
  position: z.enum(['before', 'after', 'start', 'end']).describe('Where to insert the new scene in the screenplay order.'),
  anchorSceneId: z.string().optional().describe('Required when inserting before or after a specific existing scene.'),
}).superRefine((value, ctx) => {
  if ((value.position === 'before' || value.position === 'after') && !value.anchorSceneId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['anchorSceneId'],
      message: 'anchorSceneId is required when position is before or after.',
    })
  }
})

export const editorMutationToolNames = [
  'rewriteStoryComponent',
  'rewriteProjectComponent',
  'insertScene',
  'createEntity',
  'deleteProjectComponent',
] as const

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

export const readScreenplayOutline = tool({
  description: 'Returns the screenplay outline as an ordered scene list with scene ids and sluglines. Use this first to map the script before reading a specific scene.',
  inputSchema: readScreenplayOutlineSchema,
  outputSchema: outputSchema,
  execute: async (_input, {experimental_context}) => {
    const {project} = experimental_context as RunContext
    const text = await getScreenplayOutline(project.id) || "Nothing Found"
    return { success: true, text }
  },
})

export const readEntityOutline = tool({
  description: 'Returns a compact list of entities for one type. Use this to browse characters, locations, or props before opening a specific entity.',
  inputSchema: z.object({
    entityType: z.enum(['character', 'location', 'prop']).describe('Which entity type to list.'),
  }),
  outputSchema: outputSchema,
  execute: async ({entityType}, {experimental_context}) => {
    const {project} = experimental_context as RunContext
    const text = await getEntityOutline(project.id, entityType) || "Nothing Found"
    return { success: true, text }
  },
})

export const readComponentDetails = tool({
  description: 'Returns the full content for a single scene or entity by id. Use this when you already know the exact target you need to inspect.',
  inputSchema: z.object({
    componentId: z.string().describe('The id of the scene or entity to read.'),
    type: z.enum(['scene', 'entity']).describe('Whether the target is a scene or an entity.'),
  }),
  outputSchema: outputSchema,
  execute: async ({componentId, type}) => {
    switch (type) {
      case 'scene':{
        const text = await getSceneById(componentId) || "Not Found"
        return { success: true, text }
      }
      case 'entity':{
        const text = await getEntityDetail(componentId) || "Not Found"
        return { success: true, text }
      }
      default:
        return { success: false, text: `Invalid type: ${type}` }
    }
  },
})

export const readProjectRequirements = tool({
  description: 'Returns the project brief, constraints, and high-level requirements such as format, audience, genre, tone, and duration.',
  inputSchema: z.object({}),
  outputSchema: outputSchema,
  execute: async (_input, {experimental_context}) => {
    const {project} = experimental_context as RunContext
    const text = await getProjectRequirements(project) || "Nothing Found"
    return { success: true, text }
  },
})

export const searchScreenplay = tool({
  description: 'Searches scenes by keyword, phrase, or character name and returns matching scene snippets. Use this when you know what to look for but not which scene contains it.',
  inputSchema: z.object({
    query: z.string().describe('The text, phrase, or character name to search for.'),
  }),
  outputSchema: outputSchema,
  execute: async ({query}, {experimental_context}) => {
    const {project} = experimental_context as RunContext
    const text = await searchScreenplayInProject(project.id, query) || "Nothing Found"
    return { success: true, text }
  },
})

export const readStoryContext = tool({
  description: 'Returns story-level source material such as the synopsis or the story bible. Use this for global story context rather than scene-level details.',
  inputSchema: z.object({
    component: z.enum(['synopsis', 'story_bible']).describe('Which story-level component to read.'),
  }),
  outputSchema: outputSchema,
  execute: async ({component}, {experimental_context}) => {
    const {project} = experimental_context as RunContext
    switch (component) {
      case 'synopsis':{
        const text = await getSynopsis(project) || "Nothing Found"
        return { success: true, text }
      }
      case 'story_bible':{
        const text = await getStoryBible(project.id) || "Nothing Found"
        return { success: true, text }
      }
      default:
        return { success: false, text: `Invalid component: ${component}` }
    }
  },
})

export const readComponentSchema = tool({
  description: 'Returns the JSON schema for a supported component type. Use this before generating or rewriting structured content so the output matches the required shape.',
  inputSchema: z.object({
    component: z.enum(["synopsis", "story_bible", "scene", "character", "location", "prop"]).describe('Which component schema to read.'),
  }),
  outputSchema: outputSchema,
  execute: async ({component}) => {
    const text = await getBlockSchema(component) || "Nothing Found"
    if (!text) {
      return { success: false, text: `Invalid component: ${component}` }
    }
    return { success: true, text }
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

export const rewriteStoryComponent = tool({
  description: 'Rewrites a story-level singleton component. Use this when replacing the full synopsis or the full story bible.',
  inputSchema: storyComponentSchema,
  outputSchema: mutationToolOutputSchema,
  execute: async (input) => {
    switch (input.component) {
      case 'synopsis': {
        const payload = {
          documentId: 'synopsis',
          operations: [{
            type: 'replace_document' as const,
            component: 'synopsis' as const,
            content: synopsisToProseDoc(input.content),
          }],
        }
        return createOperationsResult('Prepared synopsis replacement operations.', payload)
      }
      case 'story_bible': {
        const payload = {
          documentId: 'story_bible',
          operations: [{
            type: 'replace_document' as const,
            component: 'story_bible' as const,
            content: storyBibleToProseDoc(input.content as StoryBible),
          }],
        }
        return createOperationsResult('Prepared story bible replacement operations.', payload)
      }
    }
  },
})

export const rewriteProjectComponent = tool({
  description: 'Rewrites an existing scene, character, location, or prop by id. Use this only when you already know the exact component to replace.',
  inputSchema: projectComponentSchema,
  outputSchema: mutationToolOutputSchema,
  execute: async (input, { experimental_context }) => {
    const { project } = experimental_context as RunContext

    switch (input.component) {
      case 'scene': {
        const payload = {
          documentId: 'script',
          operations: [{
            type: 'replace_node' as const,
            component: 'scene' as const,
            nodeId: input.componentId,
            content: getSceneNode(input.componentId, input.content),
          }],
        }
        return createOperationsResult(`Prepared replacement operations for scene ${input.componentId}.`, payload)
      }
      case 'character':
      case 'location':
      case 'prop': {
        const payload = {
          documentId: 'entities',
          operations: [{
            type: 'replace_document' as const,
            component: input.component,
            componentId: input.componentId,
            content: getEntityProseDoc(project.id, input.component, input.content, input.componentId),
          }],
        }
        return createOperationsResult(`Prepared replacement operations for ${input.component} ${input.componentId}.`, payload)
      }
    }
  },
})

export const insertScene = tool({
  description: 'Inserts a new scene into the screenplay. Use explicit placement so the new scene is anchored relative to existing scene order.',
  inputSchema: z.object({
    component: z.literal('scene'),
    placement: scenePlacementSchema,
    content: sceneContentSchema.describe('The full content for the new scene.'),
  }),
  outputSchema: mutationToolOutputSchema,
  execute: async ({ placement, content }) => {
    const sceneId = `draft-scene-${crypto.randomUUID()}`
    const payload = {
      documentId: 'script',
      operations: [{
        type: 'insert_node' as const,
        component: 'scene' as const,
        position: placement.position,
        ...(placement.anchorSceneId ? { anchorNodeId: placement.anchorSceneId } : {}),
        content: getSceneNode(sceneId, content),
      }],
    }
    const anchorText = placement.anchorSceneId ? ` near scene ${placement.anchorSceneId}` : ''
    return createOperationsResult(`Prepared scene insertion operations for ${placement.position}${anchorText}.`, payload)
  },
})

export const createEntity = tool({
  description: 'Creates a new character, location, or prop. Use this when adding a new entity to the project rather than rewriting an existing one.',
  inputSchema: entityCreateSchema,
  outputSchema: mutationToolOutputSchema,
  execute: async (input, { experimental_context }) => {
    const { project } = experimental_context as RunContext
    const payload = {
      documentId: 'entities',
      operations: [{
        type: 'insert_document' as const,
        component: input.component,
        content: getEntityProseDoc(project.id, input.component, input.content),
      }],
    }
    return createOperationsResult(`Prepared creation operations for a new ${input.component}.`, payload)
  },
})

export const deleteProjectComponent = tool({
  description: 'Deletes an existing scene, character, location, or prop by id. Use this only when the user explicitly wants to remove that component.',
  inputSchema: z.object({
    component: z.enum(["scene", "character", "location", "prop"]).describe('The component to delete.'),
    componentId: z.string().describe('The id of the component to delete.'),
  }),
  outputSchema: mutationToolOutputSchema,
  execute: async ({ component, componentId }) => {
    if (component === 'scene') {
      return createOperationsResult(`Prepared deletion operations for scene ${componentId}.`, {
        documentId: 'script',
        operations: [{
          type: 'delete_node',
          component: 'scene',
          nodeId: componentId,
        }],
      })
    }

    return createOperationsResult(`Prepared deletion operations for ${component} ${componentId}.`, {
      documentId: 'entities',
      operations: [{
        type: 'delete_document',
        component,
        componentId,
      }],
    })
  },
})


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
    void instruction
    void skillset
    void expectedOutput
    void complexity
    void abortSignal

    return {
      success: false,
      text: 'delegateTask is not available in this build yet.',
    }

  },
})

