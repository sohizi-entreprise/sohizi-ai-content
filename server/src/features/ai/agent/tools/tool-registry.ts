import { BaseTool } from "./tool-definition";
import { z } from "zod";
import { createContentTool } from "./content-create";
import { rewriteContentTool } from "./content-rewrite";
import { patchContentTool } from "./content-patch";
import { deleteContentTool } from "./content-delete";
import {dataExplorerTool} from "./data-explorer";
import { manageTodoListTool } from "./tasks-manage";
import { assignTaskTool } from "./tasks-assign";


const toolRegistry = new Map<string, BaseTool<z.ZodSchema>>();

export const registerTool = (tool: BaseTool<z.ZodSchema>): void => {
    if(!toolRegistry.has(tool.params.name)){
        toolRegistry.set(tool.params.name, tool);
    }
}

export const getTool = (name: string): BaseTool<z.ZodSchema> | undefined => {
    return toolRegistry.get(name);
}

registerTool(createContentTool);
registerTool(rewriteContentTool);
registerTool(patchContentTool);
registerTool(deleteContentTool);
registerTool(dataExplorerTool);
registerTool(manageTodoListTool);
registerTool(assignTaskTool);