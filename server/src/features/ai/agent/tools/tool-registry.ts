import { BaseTool } from "./tool-definition";
import { z } from "zod";
import { manageTodoListTool } from "./tasks-manage";
import { assignTaskTool } from "./tasks-assign";
import { exploreFileTool } from "./file-explore";
import { editFileTool } from "./file-edit";
import { searchFileTool } from "./file-search";


const toolRegistry = new Map<string, BaseTool<z.ZodSchema>>();

export const registerTool = (tool: BaseTool<z.ZodSchema>): void => {
    if(!toolRegistry.has(tool.params.name)){
        toolRegistry.set(tool.params.name, tool);
    }
}

export const getTool = (name: string): BaseTool<z.ZodSchema> | undefined => {
    return toolRegistry.get(name);
}

registerTool(editFileTool);
registerTool(exploreFileTool);
registerTool(searchFileTool);
registerTool(manageTodoListTool);
registerTool(assignTaskTool);