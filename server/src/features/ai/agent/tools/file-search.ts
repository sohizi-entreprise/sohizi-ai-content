import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { findCommandSchema, grepCommandSchema, searchCommandSchema } from "./command-schema";
import { Session } from "../core/session";
import { formatChunkResults } from "@/features/file-system/utils";
import { failure, resolveFileByPathOrId, success } from "./utils";
import { searchFileNodesByFormat, searchFileNodesByName } from "@/features/file-system/repo";
import { FileNode } from "@/db/schema";
import { FileObject } from "@/features/file-system/objects/file";

const toolSchema = z.discriminatedUnion('cmd', [
    findCommandSchema,
    grepCommandSchema,
    searchCommandSchema,
]);

export const searchFileTool = buildBaseTool({
    name: "searchFile",
    description: "Search the file system using keyword search or semantic search. Keyword search supports tsquery operators (& | ! <N> :*) for precise matching — use for names, exact phrases, proximity, and prefix matching. Semantic search uses vector embeddings for meaning-based retrieval — use when you know the concept but not the exact wording.",
    inputSchema: z.object({
        command: toolSchema,
    }),
    execute: async(cmd, {session}) => {
        const input = cmd.command;
        switch (input.cmd) {
            case 'keyword-search':
                return executeKeywordSearchCommand(input, session.projectId);
            case 'semantic-search':
                return executeSemanticSearchCommand(input, session);
            case 'find':
                return executeFindCommand(input, session.projectId);
            default:
                return failure('Invalid command received. Valid commands are: keyword-search, semantic-search, find.');
        }
    }
});

async function executeKeywordSearchCommand(input: z.infer<typeof grepCommandSchema>, projectId: string) {
    const { filePathOrId, keyword } = input;
    const fileObject = await resolveFileByPathOrId(filePathOrId, projectId);

    if(!(fileObject instanceof FileObject)) {
        return fileObject;
    }
    const response = await fileObject.searchByKeyword(keyword);
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to search by keyword in ${filePathOrId}`);
    }
    if(response.data.length === 0) {
        return failure(`No matches found for "${keyword}" in ${filePathOrId}`);
    }
    const output = await formatChunkResults(response.data, 'rank');
    return success(output);
}

async function executeSemanticSearchCommand(input: z.infer<typeof searchCommandSchema>, session: Session) {
    const { projectId, embedder } = session;
    const { filePathOrId, query } = input;

    const fileObject = await resolveFileByPathOrId(filePathOrId, projectId);
    if(!(fileObject instanceof FileObject)) {
        return fileObject;
    }
    const response = await fileObject.searchByEmbedding(embedder, query, 20);
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to search by embedding in ${filePathOrId}`);
    }
    if(response.data.length === 0) {
        return failure(`No matches found for "${query}" in ${filePathOrId}`);
    }
    const output = await formatChunkResults(response.data, 'distance');
    return success(output);
}

async function executeFindCommand(input: z.infer<typeof findCommandSchema>, projectId: string) {
    const { name, format, limit } = input;
    if(!name && !format) {
        return failure('Either name or format is required.');
    }

    let files: FileNode[] = [];

    if(name){
        files = await searchFileNodesByName(projectId, name, limit);
    }

    if(format){
        files = await searchFileNodesByFormat(projectId, format, limit);
    }

    if(files.length === 0){
        return success('Nothing matches your search criteria');
    }

    let output = `Total files: ${files.length}\n---\n`;
    for(let i = 0; i < files.length; i++){
        const file = files[i];
        output += `${i + 1}. (${file.directory ? 'directory' : 'file'}) ${file.name} ${file.format ? `[format: ${file.format}]` : ''}\n`;
    }
    return success(output);
}