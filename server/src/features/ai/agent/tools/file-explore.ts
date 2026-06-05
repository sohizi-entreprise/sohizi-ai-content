import { z } from "zod";
import { buildBaseTool } from "./tool-definition";
import { listCommandSchema, 
         existsCommandSchema, 
         readCommandSchema,
         describeCommandSchema
        } from "./command-schema";
import { failure, success, formatSkill } from "./utils";
import { FileContentPayload } from "@/features/file-system/objects/file";
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
                return executeListCommand(input, session);
            case 'exists':
                return executeExistsCommand(input, session);
            case 'read':
                return executeReadCommand(input, session);
            case 'describe':
                return executeDescribeCommand(input, session);
            default:
                return failure('Invalid command received. Valid commands are: list, exists, read, describe.');
        }
    }
});

async function executeListCommand(input: z.infer<typeof listCommandSchema>, session: Session) {
    const fileObject = await session.resolveFileByPathOrId(input.filePathOrId);
    if(!fileObject){
        return failure(`File ${input.filePathOrId} not found`);
    }
    
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

async function executeExistsCommand(input: z.infer<typeof existsCommandSchema>, session: Session) {
    const fileObject = await session.resolveFileByPathOrId(input.filepath);
    if(!fileObject){
        return failure(`Path "${input.filepath}" is not found`);
    }
    return success(`${input.filepath} exists. It's a ${fileObject.isDirectory ? 'directory' : 'file'}. The ID is ${fileObject.id}.`);
}

async function executeReadCommand(input: z.infer<typeof readCommandSchema>, session: Session) {
    const fileObject = await session.resolveFileByPathOrId(input.filePathOrId);
    if(!fileObject){
        return failure(`File ${input.filePathOrId} not found`);
    }

    if(fileObject.isDirectory){
        return failure(`You cannot read the content of a directory.`);
    }
    if(fileObject.format === null){
        return failure(`The format of the file is not supported.`);
    }
    
    const content = await fileObject.getFileContent();
    if(!content.ok || content.data === null){
        return failure(content.error || 'Failed to get the content of the file.');
    }

    const data = content.data;
    
    return success(formatFileContent(data));
}

async function executeDescribeCommand(input: z.infer<typeof describeCommandSchema>, session: Session) {
    const fileObject = await session.resolveFileByPathOrId(input.filePathOrId);
    if(!fileObject){
        return failure(`File ${input.filePathOrId} not found`);
    }
    const response = await fileObject.describe();
    return success(JSON.stringify(response.data, null, 2));
}


function formatFileContent(data: FileContentPayload): string {
    switch(data.type){
        case 'markdown':
            return data.data;
        case 'skill':
            return formatSkill(data.data);
        case 'json':
            return JSON.stringify(data.data, null, 2);
        case 'ai-generated':
            return 'Reading the content of ai-generated files is not yet supported.';
        default:
            return `File of format: ${data.type} is not supported by this tool.`;
    }
}

