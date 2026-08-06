import { BaseTool } from "./tool-definition";
import { z } from "zod";
import { manageTodoListTool } from "./tasks-manage";
import { exploreFileTool } from "./file-explore";
import { searchFileTool } from "./file-search";
import { generateImageTool } from "./generate-image";
// import { generateVideoTool } from "./generate-video";
import { timelineExploreTool } from "./timeline-explore";
import { timelineEditTool } from "./timeline-edit";
import { ToolSet } from "ai";
import { editFileTool } from "./file-edit";
import { processSpeechTool } from "./process-speech";
import { endExecutionLoopTool, finishTool } from "./loop-end";
import { submitMediaJobsTool } from "./submit-media-jobs";
import { submitHtmlCompositionTool } from "./submit-html-composition";
import { loadSkillTool } from "./load-skill";
import { assignTaskTool } from "./tasks-assign";
import { imageAnalyzerTool, videoAnalyzerTool, youtubeAnalyzerTool } from "./media-analyzer";


const toolRegistry = new Map<string, BaseTool<z.ZodSchema>>();

export const registerTool = (tool: BaseTool<z.ZodSchema>): void => {
    toolRegistry.set(tool.params.name, tool);
}

export const getTool = (name: string): BaseTool<z.ZodSchema> | undefined => {
    return toolRegistry.get(name);
}

export const listTools = (): ToolSet => {
    return Object.fromEntries(
        Array.from(toolRegistry.entries()).map(([name, tool]) => [name, tool.schema])
    );
}

registerTool(endExecutionLoopTool);
registerTool(editFileTool);
registerTool(exploreFileTool);
registerTool(searchFileTool);
registerTool(manageTodoListTool);
registerTool(generateImageTool);
// registerTool(generateVideoTool);
registerTool(finishTool);
registerTool(timelineExploreTool);
registerTool(timelineEditTool);
registerTool(processSpeechTool);
registerTool(submitMediaJobsTool);
registerTool(submitHtmlCompositionTool);
registerTool(loadSkillTool);
registerTool(assignTaskTool);
registerTool(imageAnalyzerTool);
registerTool(videoAnalyzerTool);
registerTool(youtubeAnalyzerTool);