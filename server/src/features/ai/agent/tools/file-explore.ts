import { z } from "zod";
import { PathObject } from "@/features/file-system/objects/path";
import { buildBaseTool } from "./tool-definition";
import { listCommandSchema, 
         existsCommandSchema, 
         readCommandSchema,
         describeCommandSchema
        } from "./command-schema";
import { failure, success, resolveFileByPathOrId, formatSkill } from "./utils";
import { formatReadOutput } from "@/features/file-system/utils";
import { FileObject } from "@/features/file-system/objects/file";
import { fileFormat } from "@/features/file-system/constants";
import * as fileSystemRepo from "@/features/file-system/repo";
import { Session } from "../core/session";


const toolSchema = z.discriminatedUnion('cmd', [
    listCommandSchema,
    existsCommandSchema,
    readCommandSchema,
    describeCommandSchema,
]);

export const exploreFileTool = buildBaseTool({
    name: "exploreFile",
    description: "Explore the file system and get information about the files and directories.",
    inputSchema: z.object({
        command: toolSchema,
    }),
    execute: async(cmd, {session}) => {
        const input = cmd.command;
        switch (input.cmd) {
            case 'list':
                return executeListCommand(input, session.projectId);
            case 'exists':
                return executeExistsCommand(input, session.projectId);
            case 'read':
                return executeReadCommand(input, session);
            case 'describe':
                return executeDescribeCommand(input, session.projectId);
            default:
                return failure('Invalid command received. Valid commands are: list, exists, read, describe.');
        }
    }
});

async function executeListCommand(input: z.infer<typeof listCommandSchema>, projectId: string) {
    const result = await resolveFileByPathOrId(input.filePathOrId, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }
    const fileObject = result;
    
    const response = await fileObject.getDirectChildren()
    if(!response.ok || response.data === null) {
        return failure(response.error ?? `Failed to list directory ${input.filePathOrId}`);
    }
    const children = response.data;
    let output = `Total files: ${children.length}\n---\n`;
    for (let i = 0; i < children.length; i++) {
        const file = children[i];
        output += `${i + 1}. [ID: ${file.id}] - (${file.isDirectory ? 'directory' : 'file'}) - Name: ${file.name} ${file.format ? `- [format: ${file.format}]` : ''}\n`;
    }
    return success(output);
}

async function executeExistsCommand(input: z.infer<typeof existsCommandSchema>, projectId: string) {
    const pathObject = new PathObject();
    const { fileObject } = await pathObject.resolveByPath(input.filepath, projectId);
    if(!fileObject) {
        return failure(`Path "${input.filepath}" is not found`);
    }
    return success(`${input.filepath} exists. It's a ${fileObject.isDirectory ? 'directory' : 'file'}. The ID is ${fileObject.id}.`);
}

async function executeReadCommand(input: z.infer<typeof readCommandSchema>, session: Session) {
    const result = await resolveFileByPathOrId(input.filePathOrId, session.projectId);
    if(!(result instanceof FileObject)){
        return result;
    }
    const fileObject = result;
    if(fileObject.isDirectory){
        return failure(`You cannot read the content of a directory.`);
    }
    if(fileObject.format === null){
        return failure(`The format of the file is not supported.`);
    }
    const content = await session.getFileContent(fileObject.id, fileObject.format);
    if(content === null){
        return failure(`The content of the file is not found.`);
    }
    return success(content);
}

async function executeDescribeCommand(input: z.infer<typeof describeCommandSchema>, projectId: string) {
    const result = await resolveFileByPathOrId(input.filePathOrId, projectId);
    if(!(result instanceof FileObject)){
        return result;
    }
    const fileObject = result;
    const response = await fileObject.describe();
    return success(JSON.stringify(response.data, null, 2));
}

