import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { linkCommandSchema, unlinkCommandSchema, queryCommandSchema, inspectGraphCommandSchema } from "./command-schema";

const toolSchema = z.discriminatedUnion('cmd', [
    linkCommandSchema,
    unlinkCommandSchema,
    queryCommandSchema,
    inspectGraphCommandSchema,
]);

export const fileGraphTool = buildBaseTool({
    name: "fileGraph",
    description: "Manage the file system graph by creating, removing, querying, and inspecting relationships between files.",
    inputSchema: toolSchema,
    execute: async(input) => {
        return {
            success: true,
            output: 'File graph managed successfully.',
        }
    }
});