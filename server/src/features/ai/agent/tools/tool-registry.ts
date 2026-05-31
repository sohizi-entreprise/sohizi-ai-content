import { BaseTool } from "./tool-definition";
import { z } from "zod";
import { manageTodoListTool } from "./tasks-manage";
import { exploreFileTool } from "./file-explore";
import { searchFileTool } from "./file-search";
import { generateImageTool } from "./generate-image";
import { generateAudioDialogueTool, generateMusicTool, generateSoundEffectTool, generateSpeechTool } from "./generate-audio";
import { generateVideoTool } from "./generate-video";
import { timelineExploreTool } from "./timeline-explore";
import { timelineEditTool } from "./timeline-edit";
import { ToolSet } from "ai";
import { editFileTool } from "./file-edit";


const toolRegistry = new Map<string, BaseTool<z.ZodSchema>>();

export const registerTool = (tool: BaseTool<z.ZodSchema>): void => {
    if(!toolRegistry.has(tool.params.name)){
        toolRegistry.set(tool.params.name, tool);
    }
}

export const getTool = (name: string): BaseTool<z.ZodSchema> | undefined => {
    return toolRegistry.get(name);
}

export const listTools = (): ToolSet => {
    return Object.fromEntries(
        Array.from(toolRegistry.entries()).map(([name, tool]) => [name, tool.schema])
    );
}

registerTool(editFileTool);
registerTool(exploreFileTool);
registerTool(searchFileTool);
registerTool(manageTodoListTool);
registerTool(generateImageTool);
registerTool(generateVideoTool);
registerTool(generateSpeechTool);
registerTool(generateSoundEffectTool);
registerTool(generateMusicTool);
registerTool(generateAudioDialogueTool);
registerTool(timelineExploreTool);
registerTool(timelineEditTool);
// registerTool(assignTaskTool);