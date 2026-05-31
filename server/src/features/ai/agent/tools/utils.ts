import type { ToolResult } from "./tool-definition";
import { validate as validateUuid } from 'uuid';
import { FileObject } from "@/features/file-system/objects/file";
import { PathObject } from "@/features/file-system/objects/path";

export function success(output: string): ToolResult {
    return { success: true, output };
}

export function failure(output: string): ToolResult {
    return { success: false, output };
}

export async function resolveFileByPathOrId(filePathOrId: string | undefined, projectId: string) {

    if(!filePathOrId) {
        return failure('Either filepath or fileId is required.');
    }
    const filePath = filePathOrId.startsWith('/') ? filePathOrId : undefined;
    const fileId = validateUuid(filePathOrId) ? filePathOrId : undefined;

    if(!filePath && !fileId) {
        return failure('Invalid filepath or fileId provided.');
    }

    let fileObjectRef: FileObject | null = null;
    const pathObject = new PathObject();
    if(filePath) {
        const { fileObject } = await pathObject.resolveByPath(filePath, projectId);
        fileObjectRef = fileObject;
    }else if(fileId) {
        const fileObject = await pathObject.resolveById(fileId, projectId);
        fileObjectRef = fileObject;
    }
    if(!fileObjectRef) {
        return failure('File not found');
    }
    return fileObjectRef;
}