import { z } from "zod";
import { PathObject } from "@/features/file-system/objects/path";
import { buildBaseTool } from "./tool-definition";
import { listCommandSchema, 
         existsCommandSchema, 
         readCommandSchema, 
         statCommandSchema,
         diffCommandSchema
        } from "./command-schema";
import { failure, success } from "./utils";
import { formatReadOutput } from "@/features/file-system/utils";


const toolSchema = z.discriminatedUnion('cmd', [
    listCommandSchema,
    existsCommandSchema,
    readCommandSchema,
    statCommandSchema,
    // diffCommandSchema,
]);

export const exploreFileTool = buildBaseTool({
    name: "exploreFile",
    description: "Explore the file system and get information about the files and directories.",
    inputSchema: toolSchema,
    execute: async(input, {session}) => {
        switch (input.cmd) {
            case 'list':
                return executeListCommand(input, session.projectId);
            case 'exists':
                return executeExistsCommand(input, session.projectId);
            case 'read':
                return executeReadCommand(input, session.projectId);
            case 'stat':
                return executeStatCommand(input, session.projectId);
            default:
                return failure('Invalid command received. Valid commands are: list, exists, read, stat.');
        }
    }
});

async function executeListCommand(input: z.infer<typeof listCommandSchema>, projectId: string) {
    const pathObject = new PathObject();
    const { fileObject, isRoot } = await pathObject.resolveDirectoryByPath(input.filepath, projectId);
    // TODO: we will put all the folder inside a created root folder when a new project is created.
    if (!fileObject) {
        return failure(`Path "${input.filepath}" is not found`);
    }
    const response = await fileObject.getDirectChildren()
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to list ${input.filepath}`);
    }
    const children = response.data;
    let output = `Total files: ${children.length}\n---\n`;
    for (let i = 0; i < children.length; i++) {
        const file = children[i];
        output += `${i + 1}. (${file.isDirectory ? 'directory' : 'file'}) ${file.name} ${file.format ? `[format: ${file.format}]` : ''}\n`;
    }
    return success(output);
}

async function executeExistsCommand(input: z.infer<typeof existsCommandSchema>, projectId: string) {
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(input.filepath, projectId);
    if(!fileObject) {
        return failure(`Path "${input.filepath}" is not found`);
    }
    return success(`${input.filepath} exists. It's a ${fileObject.isDirectory ? 'directory' : 'file'}.`);
}

async function executeReadCommand(input: z.infer<typeof readCommandSchema>, projectId: string) {
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(input.filepath, projectId);
    if(!fileObject) {
        return failure(`Path "${input.filepath}" is not found`);
    }
    const response = await fileObject.getContent();
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `The content of the file "${input.filepath}" is not found.`);
    }

    const output = formatReadOutput(response.data.content ?? '', input.offset, input.limit);
    return success(output);
}

async function executeStatCommand(input: z.infer<typeof statCommandSchema>, projectId: string) {
    const pathObject = new PathObject();
    const { fileObject, isRoot } = await pathObject.resolveByPath(input.filepath, projectId);
    if(!fileObject) {
        return failure(`Path "${input.filepath}" is not found`);
    }
    const response = await fileObject.stats();
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to get stats of ${input.filepath}`);
    }
    const data = response.data;
    return success(JSON.stringify(data, null, 2));
}

