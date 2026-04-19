import { FileNode } from '@/db/schema';
import { EmbedderInterface } from '@/lib/rag';
import * as projectRepo from '../project/repo';
import { MAX_FILE_DEPTH, MAX_FILE_IN_DIRECTORY, fileFormat } from './constants';
import {
    FileSystemFunctionError,
    FileSystemNotFoundError,
    createFileNode as createFileNodeFn,
    deleteFileNode as deleteFileNodeFn,
    getFileContent as getFileContentFn,
    listDirectoryFiles as listDirectoryFilesFn,
    searchDirectoryContent as searchDirectoryContentFn,
    semanticSearchDirectory as semanticSearchDirectoryFn,
    updateFileNode as updateFileNodeFn,
} from './functions';
import * as fileSystemRepo from './repo';
import { countLines, countWords, formatChunkResults, formatReadOutput, normalizeFileName, serializeFileContent } from './utils';
// 1.explore_files
// ls -> ok
// exists -> ok
// read -> ok
// stat -> ok
// diff

// 2.search_files
// grep -> ok
// search -> ok

// 3.edit_files
// write
// replace

// 4. manage_files
// touch
// mkdir
// mv
// rm

// 5. entity relationships
// link
// query

const ROOT_SENTINEL = Symbol('root');

type RootSentinel = typeof ROOT_SENTINEL;
type ResolvedPath = FileNode | RootSentinel;
type ParsedPath = string[] | RootSentinel;


export const ls = async(projectId: string, path: string) => {
    const fileNode = await resolvePath(projectId, path);
    const parentId = fileNode === ROOT_SENTINEL ? null : fileNode.id;

    if(fileNode !== ROOT_SENTINEL && !fileNode.directory){
        throw new Error(`File "${path}" is not a directory.`)
    }
    const files = await listDirectoryFilesFn(projectId, parentId);
    let result = `Total files: ${files.length}\n---\n`;
    for(let i = 0; i < files.length; i++){
        const file = files[i];
        result += `${i + 1}. (${file.directory ? 'directory' : 'file'}) ${file.name} ${file.format? `[format: ${file.format}]` : ''}\n`;
    }
    return result;
}

export const exists = async(projectId: string, path: string) => {
    try {
        await resolvePath(projectId, path);
        return true;
    } catch {
        return false;
    }
}

export const read = async(projectId: string, path: string, offset?: number, limit?: number) => {
    const fileNode = await resolveFilePath(projectId, path);
    const fileContent = await getRequiredFileContent(projectId, fileNode.id, path);
    const text = serializeFileContent(fileNode, fileContent);
    return formatReadOutput(text, offset, limit);
}

export const stat = async(projectId: string, path: string) => {
    const fileNode = await resolvePath(projectId, path);

    if (fileNode === ROOT_SENTINEL) {
        const children = await listDirectoryFilesFn(projectId, null);
        return [
            `path: /`,
            `type: directory`,
            `entries: ${children.length}`,
        ].join('\n');
    }

    if (fileNode.directory) {
        const children = await listDirectoryFilesFn(projectId, fileNode.id);
        return [
            `path: ${path}`,
            `type: directory`,
            `entries: ${children.length}`,
        ].join('\n');
    }

    const fileContent = await getRequiredFileContent(projectId, fileNode.id, path);
    const text = serializeFileContent(fileNode, fileContent);

    return [
        `path: ${path}`,
        `type: file`,
        `format: ${fileNode.format ?? 'unknown'}`,
        `lines: ${countLines(text)}`,
        `words: ${countWords(text)}`,
    ].join('\n');
}

export const grep = async(projectId: string, path: string, keyword: string, limit = 20) => {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) {
        throw new Error('Keyword cannot be empty.')
    }

    const fileNode = await resolvePath(projectId, path);

    if (fileNode === ROOT_SENTINEL) {
        const hits = await fileSystemRepo.searchProjectChunksByKeyword(projectId, normalizedKeyword, limit);
        return formatChunkResults(hits, 'rank');
    }

    if (fileNode.directory) {
        const hits = await searchDirectoryContentFn({
            projectId,
            fileNodeId: fileNode.id,
            keyword: normalizedKeyword,
            limit,
        });
        return formatChunkResults(hits, 'rank');
    }

    const fileContent = await getRequiredFileContent(projectId, fileNode.id, path);
    const text = serializeFileContent(fileNode, fileContent);
    const lines = text === '' ? [] : text.split(/\r?\n/);
    const matches: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(normalizedKeyword)) {
            matches.push(`${i + 1}|${lines[i]}`);
        }
        if (matches.length >= limit) {
            break;
        }
    }

    if (matches.length === 0) {
        return `No matches found for "${normalizedKeyword}".`;
    }

    return [`Matches in ${path}:`, ...matches].join('\n');
}

export const search = async(
    projectId: string,
    path: string,
    query: string,
    embedder: EmbedderInterface,
    limit = 20,
) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
        throw new Error('Search query cannot be empty.')
    }

    const fileNode = await resolvePath(projectId, path);

    if (fileNode === ROOT_SENTINEL) {
        const queryEmbedding = await embedder.embedQuery(normalizedQuery);
        const hits = await fileSystemRepo.semanticSearchProjectChunks(projectId, queryEmbedding, limit);
        return formatChunkResults(hits, 'distance');
    }

    const hits = await semanticSearchDirectoryFn({
        projectId,
        fileNodeId: fileNode.id,
        query: normalizedQuery,
        limit,
    }, embedder)

    return formatChunkResults(hits, 'distance');
}

export const touch = async(projectId: string, path: string, fname: string) => {
    const parent = await resolveDirectoryPath(projectId, path);
    const parentId = parent === ROOT_SENTINEL ? null : parent.id;
    const normalizedName = normalizeAndValidateName(fname);
    const position = await fileSystemRepo.getNextFileNodePosition(projectId, parentId);

    const file = await runFileSystemFunction(() => createFileNodeFn({
        projectId,
        name: normalizedName,
        directory: false,
        parentId,
        position,
        format: fileFormat.MARKDOWN,
    }));

    return file.id;
}

export const mkdir = async(projectId: string, path: string) => {
    const parts = parsePath(path);
    if (parts === ROOT_SENTINEL) {
        await ensureProjectExists(projectId);
        return '/';
    }

    let parentId: string | null = null;
    let currentNode: FileNode | undefined;

    for (const rawPart of parts) {
        const normalizedPart = normalizeAndValidateName(rawPart);
        currentNode = await fileSystemRepo.getFileNodeByName(projectId, parentId, normalizedPart);

        if (currentNode) {
            if (!currentNode.directory) {
                throw new Error(`Cannot create directory "${path}" because "${normalizedPart}" is a file.`)
            }
        } else {
            const position = await fileSystemRepo.getNextFileNodePosition(projectId, parentId);
            currentNode = await runFileSystemFunction(() => createFileNodeFn({
                projectId,
                name: normalizedPart,
                directory: true,
                parentId,
                position,
                format: null,
            }));
        }

        parentId = currentNode.id;
    }

    if (!currentNode) {
        throw new Error(`Failed to create directory "${path}".`)
    }

    return currentNode.id;
}

export const mv = async(projectId: string, oldPath: string, newPath: string) => {
    const source = await resolveConcretePath(projectId, oldPath);
    const { parentPath, name } = splitParentAndName(newPath);
    const destinationParent = await resolveDirectoryPath(projectId, parentPath);
    const destinationParentId = destinationParent === ROOT_SENTINEL ? null : destinationParent.id;
    const normalizedName = normalizeAndValidateName(name);

    if (source.parentId === destinationParentId && source.name === normalizedName) {
        return await fileSystemRepo.getFileNodePathById(projectId, source.id) ?? oldPath;
    }

    if (source.directory) {
        await assertNotMovingIntoDescendant(projectId, source.id, destinationParentId, newPath);
    }

    const conflictingNode = await fileSystemRepo.getFileNodeByName(projectId, destinationParentId, normalizedName);
    if (conflictingNode && conflictingNode.id !== source.id) {
        throw new Error(`A file or directory named "${normalizedName}" already exists at "${parentPath}".`)
    }

    const destinationSiblings = destinationParentId === source.parentId
        ? null
        : await listDirectoryFilesFn(projectId, destinationParentId);

    if (destinationSiblings && destinationSiblings.length >= MAX_FILE_IN_DIRECTORY) {
        throw new Error(`Maximum file count of ${MAX_FILE_IN_DIRECTORY} exceeded in this directory`)
    }

    const subtreeHeight = source.directory
        ? await fileSystemRepo.getFileNodeSubtreeHeight(projectId, source.id)
        : 0;
    const parentDepth = destinationParentId === null
        ? -1
        : await fileSystemRepo.getFileNodeDepthById(projectId, destinationParentId);

    if (parentDepth === null) {
        throw new Error(`Invalid destination parent path "${parentPath}".`)
    }

    const nextDepth = parentDepth + 1 + (subtreeHeight ?? 0);
    if (nextDepth > MAX_FILE_DEPTH) {
        throw new Error(`Maximum file depth of ${MAX_FILE_DEPTH} exceeded`)
    }
    
    const moved = await runFileSystemFunction(() => updateFileNodeFn(projectId, {
        id: source.id,
        name: normalizedName,
        parentId: destinationParentId,
        position: 'end',
    }));

    return await fileSystemRepo.getFileNodePathById(projectId, moved.id) ?? newPath;
}

export const rm = async(projectId: string, path: string) => {
    const fileNode = await resolveConcretePath(projectId, path);
    if (fileNode.isBuiltIn) {
        throw new Error('Cannot delete a built-in file');
    }
    await runFileSystemFunction(() => deleteFileNodeFn(projectId, fileNode.id));
    return `Deleted ${path}`;
}



// ===================== UTILITIES =====================

async function resolvePath(projectId: string, path: string): Promise<ResolvedPath> {
    const parts = parsePath(path);
    if (parts === ROOT_SENTINEL) {
        return ROOT_SENTINEL;
    }
  
    let parentId: string | null = null;
    let node: FileNode | undefined;
  
    for (const part of parts) {
        node = await fileSystemRepo.getFileNodeByName(projectId, parentId, part);
        if (!node) {
            throw new Error(`File "${path}" is not found. Check if the path is correct and the file exists.`)
        }
        parentId = node.id;
    }

    if(!node){
        throw new Error(`Invalid path provided - "${path}"`)
    }
  
    return node;
}

async function resolveFilePath(projectId: string, path: string) {
    const fileNode = await resolvePath(projectId, path);
    if (fileNode === ROOT_SENTINEL) {
        throw new Error(`File "${path}" is a directory.`)
    }
    if (fileNode.directory) {
        throw new Error(`File "${path}" is a directory.`)
    }
    return fileNode;
}

async function resolveConcretePath(projectId: string, path: string) {
    const fileNode = await resolvePath(projectId, path);
    if (fileNode === ROOT_SENTINEL) {
        throw new Error('Cannot target the root directory directly.')
    }
    return fileNode;
}

async function resolveDirectoryPath(projectId: string, path: string) {
    const fileNode = await resolvePath(projectId, path);
    if (fileNode !== ROOT_SENTINEL && !fileNode.directory) {
        throw new Error(`Path "${path}" is not a directory.`)
    }
    return fileNode;
}

async function getRequiredFileContent(projectId: string, fileNodeId: string, path: string) {
    try {
        return await getFileContentFn(projectId, fileNodeId);
    } catch (error) {
        if (error instanceof FileSystemNotFoundError) {
            throw new Error(`File "${path}" has no content.`)
        }
        rethrowFileSystemFunctionError(error);
    }
}

async function ensureProjectExists(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if (!project) {
        throw new Error('Project not found')
    }
}

async function runFileSystemFunction<T>(factory: () => Promise<T>) {
    try {
        return await factory();
    } catch (error) {
        rethrowFileSystemFunctionError(error);
    }
}

function rethrowFileSystemFunctionError(error: unknown): never {
    if (error instanceof FileSystemFunctionError) {
        throw new Error(error.message)
    }
    throw error;
}

async function assertNotMovingIntoDescendant(
    projectId: string,
    sourceId: string,
    destinationParentId: string | null,
    newPath: string,
) {
    if (!destinationParentId) {
        return;
    }

    const isInsideSource = await fileSystemRepo.isFileNodeInAncestorChain(
        projectId,
        destinationParentId,
        sourceId,
    );

    if (isInsideSource) {
        throw new Error(`Cannot move to "${newPath}" because it is inside the source directory.`)
    }
}

function splitParentAndName(path: string) {
    const parts = parsePath(path);

    if (parts === ROOT_SENTINEL) {
        throw new Error(`Invalid path provided - "${path}"`)
    }

    const name = parts[parts.length - 1];
    if (!name) {
        throw new Error(`Invalid path provided - "${path}"`)
    }

    const parentParts = parts.slice(0, -1);

    return {
        parentPath: parentParts.length === 0 ? '/' : `/${parentParts.join('/')}`,
        name,
    };
}

function normalizeAndValidateName(name: string) {
    const normalizedName = normalizeFileName(name);
    if (!normalizedName) {
        throw new Error(`Invalid name "${name}".`)
    }
    return normalizedName;
}

function parsePath(path: string): ParsedPath {
    const trimmedPath = path.trim();
    if(trimmedPath === '' || trimmedPath === '/' || trimmedPath === './' || trimmedPath === '.'){
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
            throw new Error(`Invalid path provided - "${path}"`)
        }
        if(part === '.' || part === '..' || /[/\.]/.test(part)){
            throw new Error(`Invalid path: slash or dot not allowed in filename - "${path}"`)
        }
    }
    return parts;
}