import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { grepCommandSchema, searchCommandSchema } from "./command-schema";
import { PathObject } from "@/features/file-system/objects/path";
import { Session } from "../core/session";
import { formatChunkResults } from "@/features/file-system/utils";
import { failure, success } from "./utils";

const toolSchema = z.discriminatedUnion('cmd', [
    grepCommandSchema,
    searchCommandSchema,
]);

export const searchFileTool = buildBaseTool({
    name: "searchFile",
    description: "Search the file system using a keyword or a semantic query. Use keyword search for exact keywords or phrases matching. Semantic query when you know the meaning but not the exact wording.",
    inputSchema: z.object({
        command: toolSchema,
    }),
    execute: async(cmd, {session}) => {
        const input = cmd.command;
        switch (input.cmd) {
            case 'grep':
                return executeGrepCommand(input, session.projectId);
            case 'search':
                return executeSearchCommand(input, session);
            default:
                return failure('Invalid command received. Valid commands are: grep, search.');
        }
    }
});

async function executeGrepCommand(input: z.infer<typeof grepCommandSchema>, projectId: string) {
    const { filepath, keyword } = input;
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(filepath, projectId);
    if(!fileObject) {
        return failure(`File ${filepath} not found`);
    }
    const response = await fileObject.searchByKeyword(keyword);
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to search by keyword in ${filepath}`);
    }
    if(response.data.length === 0) {
        return failure(`No matches found for "${keyword}" in ${filepath}`);
    }
    const output = await formatChunkResults(response.data, 'rank');
    return success(output);
}

async function executeSearchCommand(input: z.infer<typeof searchCommandSchema>, session: Session) {
    const { projectId, embedder } = session;
    const { filepath, query } = input;
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(filepath, projectId);
    if(!fileObject) {
        return failure(`File ${filepath} not found`);
    }
    const response = await fileObject.searchByEmbedding(embedder, query, 20);
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to search by embedding in ${filepath}`);
    }
    if(response.data.length === 0) {
        return failure(`No matches found for "${query}" in ${filepath}`);
    }
    const output = await formatChunkResults(response.data, 'distance');
    return success(output);
}