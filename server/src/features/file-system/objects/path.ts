import type { FileNode } from "@/db/schema";
import * as fileSystemRepo from '../repo';
import {FileObject} from './file';

const ROOT_SENTINEL = Symbol('root');

type RootSentinel = typeof ROOT_SENTINEL;
type ParsedPath = string[] | RootSentinel;
type ResolvedPath = {
    fileNode: FileNode | null;
    isRoot: boolean;
};
type ResolvedFileObject = {
    fileObject: FileObject | null;
    isRoot: boolean;
};

export class PathObject {
    async resolveByPath(path: string, projectId: string): Promise<ResolvedFileObject> {
        const {fileNode, isRoot} = await this.validatePath(projectId, path);
        return {
            fileObject: fileNode ? new FileObject(fileNode) : null,
            isRoot,
        };
    }

    async resolveById(id: string, projectId: string): Promise<FileObject | null> {
        const fileNode = await fileSystemRepo.getFileNodeById(projectId, id);
        if (!fileNode) {
            return null;
        }
        return new FileObject(fileNode);
    }

    async resolveDirectoryByPath(path: string, projectId: string): Promise<ResolvedFileObject> {
        const resolved = await this.resolveByPath(path, projectId);
        if (!resolved.isRoot && resolved.fileObject && !resolved.fileObject.isDirectory) {
            throw new Error(`Path "${path}" is not a directory.`);
        }

        return resolved;
    }

    splitParentAndName(path: string) {
        const parts = this.parsePath(path);
        if (parts === ROOT_SENTINEL) {
            throw new Error(`Invalid path provided - "${path}"`);
        }

        const name = parts[parts.length - 1];
        const parentParts = parts.slice(0, -1);
        const parentPath = parentParts.length === 0 ? '/' : `/${parentParts.join('/')}`;
        return { parentPath, name };
    }

    buildChildPath(parentPath: string, name: string) {
        const normalizedParent = parentPath.trim();
        if (normalizedParent === '' || normalizedParent === '/' || normalizedParent === './' || normalizedParent === '.') {
            return `/${name}`;
        }

        return `${normalizedParent.replace(/\/+$/, '')}/${name}`;
    }

    private async validatePath(projectId: string, path: string): Promise<ResolvedPath> {
        const parts = this.parsePath(path);
        if (parts === ROOT_SENTINEL) {
            return { fileNode: null, isRoot: true };
        }

        let parentId: string | null = null;
        let node: FileNode | undefined;

        for (const part of parts) {
            node = await fileSystemRepo.getFileNodeByName(projectId, parentId, part);
            if (!node) {
                return { fileNode: null, isRoot: false };
            }
            parentId = node.id;
        }

        return { fileNode: node ?? null, isRoot: false };
    }

    private parsePath(path: string): ParsedPath {
        const trimmedPath = path.trim();
        if (trimmedPath === '' || trimmedPath === '/' || trimmedPath === './' || trimmedPath === '.') {
            return ROOT_SENTINEL;
        }

        let normalizedPath = trimmedPath;
        while (normalizedPath.startsWith('./')) {
            normalizedPath = normalizedPath.slice(2);
        }
        while (normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.slice(1);
        }

        if (normalizedPath === '') {
            return ROOT_SENTINEL;
        }

        const parts = normalizedPath.split('/');
        for (const part of parts) {
            if (!part) {
                throw new Error(`Invalid path provided - "${path}"`);
            }
            if (part === '.' || part === '..' || /[/\.]/.test(part)) {
                throw new Error(`Invalid path: slash or dot not allowed in filename - "${path}"`);
            }
        }

        return parts;
    }
}