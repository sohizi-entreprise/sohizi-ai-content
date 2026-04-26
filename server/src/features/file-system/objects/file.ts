import { FileNode, FileNodeContent } from "@/db/schema";
import { ProseDocument } from "@/type";
import { EmbedderInterface } from "@/lib/rag";
import {
    deleteFileNode as deleteFileNodeFn,
    getFileContent as getFileContentFn,
    listDirectoryFiles as listDirectoryFilesFn,
    searchDirectoryContent as searchDirectoryContentFn,
    semanticSearchDirectory as semanticSearchDirectoryFn,
    updateFileContent as updateFileContentFn,
    updateFileNode as updateFileNodeFn,
} from "../functions";
import { FileNodeInsertPosition } from "../payload";
import { ChunkHit } from "../types";
import { countLines, countWords, normalizeFileName, serializeFileContent } from "../utils";


type FileObjectResponse<T> = {
    ok: boolean;
    data: T;
    error?: string;
}

function ok<T>(data: T): FileObjectResponse<T> {
    return {
        ok: true,
        data,
    };
}

function err(error: string): FileObjectResponse<null> {
    return {
        ok: false,
        error,
        data: null,
    };
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
}

export class FileObject {
    private fileNode: FileNode;

    constructor(fileNode: FileNode){
        this.fileNode = fileNode;
    }

    get format(){
        return this.fileNode.format;
    }

    get id() {
        return this.fileNode.id;
    }

    get name() {
        return this.fileNode.name;
    }

    get isDirectory(){
        return this.fileNode.directory;
    }

    async getContent(): Promise<FileObjectResponse<FileNodeContent | null>> {
        if (this.fileNode.directory) {
            return err(`Cannot get content of a directory ${this.fileNode.name}`);
        }

        try {
            const fileContent = await getFileContentFn(this.fileNode.projectId, this.fileNode.id);
            return ok(fileContent);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to get content of ${this.fileNode.name}`));
        }
    }

    async getDirectChildren(): Promise<FileObjectResponse<FileObject[] | null>> {
        if (!this.fileNode.directory) {
            return err(`Cannot get children of a file ${this.fileNode.name}`);
        }

        try {
            const children = await listDirectoryFilesFn(this.fileNode.projectId, this.fileNode.id);
            return ok(children.map((child) => new FileObject(child)));
        } catch (error) {
            return err(getErrorMessage(error, `Failed to get children of ${this.fileNode.name}`));
        }
    }

    async searchByKeyword(keyword: string, limit = 20): Promise<FileObjectResponse<ChunkHit[] | null>> {
        const normalizedKeyword = keyword.trim();
        if (!normalizedKeyword) {
            return err('Keyword cannot be empty');
        }

        try {
            const hits = await searchDirectoryContentFn({
                projectId: this.fileNode.projectId,
                fileNodeId: this.fileNode.id,
                keyword: normalizedKeyword,
                limit,
            });
            return ok(hits);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to search inside ${this.fileNode.name}`));
        }
    }

    async searchByEmbedding(embedder: EmbedderInterface, query: string, limit = 20): Promise<FileObjectResponse<ChunkHit[] | null>> {
        const normalizedQuery = query.trim();
        if (!normalizedQuery) {
            return err('Query cannot be empty');
        }

        try {
            const hits = await semanticSearchDirectoryFn({
                projectId: this.fileNode.projectId,
                fileNodeId: this.fileNode.id,
                query: normalizedQuery,
                limit,
            }, embedder);

            return ok(hits);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to search by embedding inside ${this.fileNode.name}`));
        }
    }

    async moveTo(
        newDirectory: FileObject | null,
        position: FileNodeInsertPosition,
        anchorId?: string | null,
        newName?: string,
    ): Promise<FileObjectResponse<string | null>> {
        if (newDirectory && !newDirectory.fileNode.directory) {
            return err(`Cannot move file ${this.fileNode.name} into non-directory ${newDirectory.fileNode.name}`);
        }

        try {
            const updatedFileNode = await updateFileNodeFn(this.fileNode.projectId, {
                id: this.fileNode.id,
                ...(newName === undefined ? {} : { name: newName }),
                parentId: newDirectory?.fileNode.id ?? null,
                position,
                ...(anchorId === undefined ? {} : { anchorId }),
            });

            this.fileNode = updatedFileNode;
            return ok(`File moved to ${newDirectory?.fileNode.name ?? '/'} successfully`);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to move file ${this.fileNode.name} to ${newDirectory?.fileNode.name ?? '/'}`));
        }
    }

    async rename(newName: string): Promise<FileObjectResponse<FileObject | null>> {
        if (!this.fileNode.editable) {
            return err(`Cannot rename a built-in file ${this.fileNode.name}`);
        }
        const normalizedName = normalizeFileName(newName);
        if (!normalizedName) {
            return err('Invalid file name');
        }

        try {
            const updatedFileNode = await updateFileNodeFn(this.fileNode.projectId, {
                id: this.fileNode.id,
                name: normalizedName,
            });

            this.fileNode = updatedFileNode;
            return ok(this);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to rename file ${this.fileNode.name}`));
        }
    }

    async delete(): Promise<FileObjectResponse<string | null>> {
        if (!this.fileNode.editable) {
            return err(`Cannot delete a built-in file ${this.fileNode.name}`);
        }

        try {
            await deleteFileNodeFn(this.fileNode.projectId, this.fileNode.id);
            return ok(`File ${this.fileNode.name} deleted successfully`);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to delete file ${this.fileNode.name}`));
        }
    }

    async copyTo(targetFile: FileObject): Promise<FileObjectResponse<string | null>> {
        if (this.fileNode.directory) {
            return err(`Cannot copy a directory ${this.fileNode.name}`);
        }
        const response = await this.getContent();
        if (response.error) {
            return err(response.error);
        }
        const content = response.data;
        if (!content) {
            return err(`Invalid content inside the file ${this.fileNode.name}`);
        }

        const writeResponse = await targetFile.writeContent({
            content: content.content ?? '',
            jsonContent: content.jsonContent ?? {},
            proseContent: content.proseContent ?? undefined,
        });

        if (!writeResponse.ok) {
            return err(writeResponse.error ?? `Failed to copy ${this.fileNode.name} to ${targetFile.fileNode.name}`);
        }

        return ok(`File ${this.fileNode.name} copied to ${targetFile.fileNode.name} successfully`);
    }

    async writeContent(data: {content: string; jsonContent?: Record<string, any>; proseContent?: ProseDocument}): Promise<FileObjectResponse<string | null>> {
        if (this.fileNode.directory) {
            return err(`Cannot write content to a directory ${this.fileNode.name}`);
        }

        try {
            await updateFileContentFn(this.fileNode.projectId, this.fileNode.id, data);
            return ok(`Content written to ${this.fileNode.name} successfully`);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to write content to ${this.fileNode.name}`));
        }
    }

    async patchContent(data: {oldText: string; newText: string; replaceAll: boolean}): Promise<FileObjectResponse<string | null>> {
        if (this.fileNode.directory) {
            return err(`Cannot patch content of a directory ${this.fileNode.name}`);
        }

        try {
            const response = await this.getContent();
            if (!response.ok) {
                return err(response.error ?? `Failed to get content of ${this.fileNode.name}`);
            }
            const content = response.data;
            if (content === null) {
                return err(`Invalid content inside the file ${this.fileNode.name}`);
            }

            const originalText = content.content ?? '';
            const patchedText = data.replaceAll
                ? originalText.replaceAll(data.oldText, data.newText)
                : originalText.replace(data.oldText, data.newText);

            if (data.oldText !== '' && patchedText === originalText) {
                return err(`Text "${data.oldText}" was not found in ${this.fileNode.name}`);
            }

            await updateFileContentFn(this.fileNode.projectId, this.fileNode.id, {
                content: patchedText,
            });

            return ok(`Content patched in ${this.fileNode.name} successfully`);
        } catch (error) {
            return err(getErrorMessage(error, `Failed to patch content in ${this.fileNode.name}`));
        }
    }

    async stats(): Promise<FileObjectResponse<Record<string, any> | null>> {
        if (this.fileNode.directory) {
            const response = await this.getDirectChildren();
            if (response.error) {
                return err(response.error);
            }
            const children = response.data;
            return ok({
                type: 'directory',
                entries: children?.length ?? 0,
            });
        }
        const response = await this.getContent();
        if (!response.ok) {
            return err(response.error ?? 'Failed to get content');
        }
        const content = response.data;
        if (!content) {
            return err(`Invalid content inside the file ${this.fileNode.name}`);
        }
        const text = serializeFileContent(this.fileNode, content);
        return ok({
            type: 'file',
            format: this.fileNode.format ?? 'unknown',
            lines: countLines(text),
            words: countWords(text),
        });
    }

}
