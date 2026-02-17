import { z } from 'zod';
import { blockTypeList } from '../schema';


export const addBlockSchema = z.object({
  blockType: z.enum(blockTypeList).describe('an unique identifier of this block'),
  parentId: z.string().describe('the id of the parent block that includes the current block'),
  insertIndex: z.number().describe('the index at which the block should be inserted. If not provided, the block will be added at the end of the parent block.'),
  instruction: z.string().describe('a clear and concise instruction on what this block should be about. Make it clearer so that the writer can generate the content accordingly'),
});

export const todoWriteSchema = z.object({
  tasks: z.array(z.string()).describe('A list of tasks to complete. The task description should be clear and concise.'),
});

export const updateBlockSchema = z.object({
  blockId: z.string().describe('The id of the block to update'),
  instruction: z.string().describe('A clear and concise instruction on what this block should be about. Make it clearer so that the writer can generate the content accordingly'),
});

// export const readBlockSchema = z.object({
//   blockId: z.string().describe('The id of the block to read'),
// });

export const removeBlockSchema = z.object({
  blockId: z.string().describe('The id of the block to remove'),
});

export const reviewBlockSchema = z.object({
  blockId: z.string().describe('The id of the block to review'),
});


export const scriptAgentToolDefinitions = [
  {
    "name": "addBlock",
    "description": "Creates a new script block with the specified type and content. CRITICAL: ONLY use this for blocks that DO NOT already exist in the script. Before calling this, you MUST verify the block doesn't exist. If it exists, use updateBlock instead. After calling this tool, you MUST call reviewBlock for the newly created block to ensure quality.",
    "parameters": z.toJSONSchema(addBlockSchema)
  },
  {
    "name": "todoWrite",
    "description": "Manages your task list for complex requests requiring 2+ steps. Use this to break down tasks and track progress. This overwrites the previous list, so always provide the complete up-to-date list of all tasks with their current status.",
    "parameters": z.toJSONSchema(todoWriteSchema)
  },
  {
    "name": "updateBlock",
    "description": "Modifies an existing script block. Use this tool when you want to modify a block that already exists in the script. For example, after reviewing a block, if there are some feedback, you can call this tool to update the block content.",
    "parameters": z.toJSONSchema(updateBlockSchema)
  },
  {
    "name": "removeBlock",
    "description": "Deletes a specific block from the script.",
    "parameters": z.toJSONSchema(removeBlockSchema)
  },
  {
    "name": "reviewBlock",
    "description": "Sends a block to the reviewer for quality assessment and improvement suggestions. MANDATORY after writing a new block call to ensure the content meets project requirements. Do not review the same block more than once.",
    "parameters": z.toJSONSchema(reviewBlockSchema)
  }
] as const;


export const scriptAgentToolSet = {
  addBlock: addBlockSchema,
  todoWrite: todoWriteSchema,
  updateBlock: updateBlockSchema,
  // readBlock: readBlockSchema,
  removeBlock: removeBlockSchema,
  reviewBlock: reviewBlockSchema,
} as const;
