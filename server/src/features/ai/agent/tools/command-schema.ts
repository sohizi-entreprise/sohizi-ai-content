import { z } from "zod";
import { proseDocumentSchema } from "zSchemas";
/*
USE this repo: https://github.com/forscht/PGFs/blob/main/fs.sql

// lists the contents of a directory specified by the file path
ls(filepath text) setof fs

// returns the metadata of the file or directory specified by the given file path.
stat(filepath text) setof fs

// creates new file
touch(filepath text, fname text) setof fs 

// creates a new directory recursively. Equivalent to mkdir -p
mkdir(filepath text) setof fs 

// returns all files and directories under the specified directory recursively.
tree(filepath text) setof fs 

// move or rename files or directories.
mv(filepath text, filepath text) void 

// delete a file or directory recursively, Equivalent to rm -rf
rm(filepath text) void 

1.explore_files
ls
exists
read
stat
diff

2.search_files
grep
search

3.edit_files
write
replace

4. manage_files
touch
mkdir
mv
rm
5. entity relationships
 link
 query

*/

// ====================== FILE SYSTEM COMMANDS ======================
const filePath = z.string().min(1).describe("Absolute file or directory path. Use / for the root directory.");
const positiveInt = z.number().int().min(1);

export const listCommandSchema = z.object({
    cmd: z.literal('list').describe("lists the files and directories under a directory"),
    filepath: filePath,
}).describe(`
    Returns: enumerated list of files and directories under the specified directory path.
    Example: {"cmd": "list", "filepath": "/folder"} => 1. (file) file-name-1 [format: json] \n 2. (directory) folder-name-2
`.trim());

export const statCommandSchema = z.object({
    cmd: z.literal('stat').describe("Returns the metadata of the file or directory specified by the file path."),
    filepath: filePath,
}).describe(`
    Returns: metadata of the file or directory.
    - for file: lines number, words count, format
    - for directory: number of files
    Example: {"cmd": "stat", "filepath": "/folder/file"} => words count: 100, lines number: 10, format: text
`.trim());

export const createCommandSchema = z.object({
    cmd: z.literal('create').describe("Creates a new file or directory"),
    filepath: filePath,
    dir: z.boolean().default(false).describe("Whether to create a directory or a file"),
    name: z.string().min(1).describe("The file/directory name in lowercase separated by underscores for multiple words."),
    position: z.object({
        anchorFile: z.string().optional().describe("The file name to anchor the new file to. Only required if insertMode is after or before"),
        insertMode: z.enum(['end', 'start', 'after', 'before']).describe("Determines where this new content is placed"),
    })
}).describe(`
    Returns: the new file path.
    Example 1 - file: {"cmd": "create", "filepath": "/folder", "dir": false, "name": "file-name", "position": {"anchorFile": "anchor-file-name", "insertMode": "after"}} => /folder/file_name
    Example 2 - directory: {"cmd": "create", "filepath": "/folder", "dir": true, "name": "directory-name", "position": {"insertMode": "start"}} => /folder/directory-name
`.trim());

export const writeCommandSchema = z.object({
    cmd: z.literal('write').describe("writes to an existing file."),
    filepath: filePath,
    content: z.string().describe("The content to write to the file."),
}).describe(`
    Returns: confirmation message.
    Example: {"cmd": "write", "filepath": "/folder/file", "content": "Hello world"} => confirmation message
`.trim());

export const deleteCommandSchema = z.object({
    cmd: z.literal('delete').describe("Delete a file or directory recursively, Equivalent to rm -rf"),
    filepath: filePath,
});

export const patchCommandSchema = z.object({
    cmd: z.literal('patch').describe("replaces a unique text snippet inside a file without rewriting the entire file manually."),
    filepath: filePath,
    oldText: z.string().min(1).describe("Exact existing text to replace. It should uniquely identify one location."),
    newText: z.string().describe("The new text."),
    replaceAll: z.boolean().default(false).describe("Replace every occurrence instead of only the first matching one."),
}).describe(`
    Returns: confirmation message.
    Example: {"cmd": "patch", "filepath": "/folder/file", "oldText": "old text", "newText": "new text", "replaceAll": false} => confirmation message
`.trim());

export const readCommandSchema = z.object({
    cmd: z.literal('read').describe("Reads file content with optional line windowing for large files."),
    filepath: filePath,
    offset: z.number().int().optional().describe("Optional 1-based starting line number."),
    limit: positiveInt.optional().describe("Optional maximum number of lines to return."),
}).describe(`
    Returns: the full file content or only the requested line range.
    Example: {"cmd": "read", "filepath": "/folder/file", "offset": 41, "limit": 20} => lines 41-60 of the file
`.trim());

export const moveCommandSchema = z.object({
    cmd: z.literal('move').describe("Moves or renames a file or directory."),
    oldPath: filePath,
    newPath: filePath,
    position: z.object({
        anchorFile: z.string().optional().describe("The file name to anchor the new file to in the new path. Only required if insertMode is after or before"),
        insertMode: z.enum(['end', 'start', 'after', 'before']).describe("Determines where this new content is placed"),
    })
}).describe(`
    Returns: confirmation message.
    Example: {"cmd": "move", "oldPath": "/folder/file", "newPath": "/folder/new-file", "position": {"anchorFile": "anchor-file-name", "insertMode": "after"}} => confirmation message
`.trim());

export const copyCommandSchema = z.object({
    cmd: z.literal('copy').describe("Copy the content of a file to another file. It overwrites the existing content of the target file."),
    fromPath: filePath,
    toPath: filePath,
});

export const grepCommandSchema = z.object({
    cmd: z.literal('grep').describe("Perform exact text or keyword search in a file or directory."),
    filepath: filePath,
    keyword: z.string().min(1).describe("Exact text keyword or phrase to search for."),
}).describe(`
    Returns: chunks hits that are semantically relevant to the query.
    Example: {"cmd": "grep", "filepath": "/folder", "keyword": "TODO"} => chunks hits
`.trim());

export const searchCommandSchema = z.object({
    cmd: z.literal('search').describe("Perform semantic search in a file or directory using a natural-language query."),
    filepath: filePath,
    query: z.string().min(1).describe("Semantic search query describing the meaning you want to find."),
}).describe(`
    Returns: chunks hits that are semantically relevant to the query.
    Example: {"cmd": "search", "filepath": "/folder", "query": "scenes where the hero gives up"} => chunks hits
`.trim());

export const existsCommandSchema = z.object({
    cmd: z.literal('exists').describe("Check if a file or directory exists."),
    filepath: filePath,
}).describe(`
    Returns: true if the file or directory exists, false otherwise.
    Example: {"cmd": "exists", "filepath": "/folder/file"} => true
`.trim());

export const diffCommandSchema = z.object({
    cmd: z.literal('diff').describe("Shows what changed in the content of the file compared to the latest version."),
    filepath: filePath
}).describe(`
    Returns: a diff showing the changes on the file compared to the latest version.
    Example: {"cmd": "diff", "filepath": "/folder/file_id"} => diff output
`.trim());


export const linkCommandSchema = z.object({
    cmd: z.literal('link').describe("Create a link between two files based on their content. Use this to maintain a knowledge graph of the file system."),
    filepath: filePath,
    targetPath: filePath,
    relation: z.string().min(1).describe("A short verb describing the relationship between the two files. e.g. 'uses', 'depends-on', 'is-derived-from', 'is-located-in', 'is-worn-by', 'appears-in'. Reuse the relation type as much as possible to avoid creating too many links."),
}).describe(`
    Returns: confirmation message.
    Example: {"cmd": "link", "filepath": "/folder/character-file", "targetPath": "/folder/shot-file", "relation": "appears-in"} => confirmation message
`.trim());

export const unlinkCommandSchema = z.object({
    cmd: z.literal('unlink').describe("Remove a link between two files."),
    filepath: filePath,
    targetPath: filePath,
}).describe(`
    Returns: confirmation message.
    Example: {"cmd": "unlink", "filepath": "/folder/character-file", "targetPath": "/folder/shot-file"} => confirmation message
`.trim());

export const queryCommandSchema = z.object({
    cmd: z.literal('query').describe("Query the file system using a natural-language query."),
    relation: z.string().min(1).describe("The type of relation to query. e.g. 'uses', 'depends-on', 'is-derived-from', 'is-located-in', 'is-worn-by', 'appears-in'. Reuse the relation type as much as possible to avoid creating too many links."),
    leftFilePath: z.string().optional().describe("The file path to use as filter for the left node of the relation."),
    rightFilePath: z.string().optional().describe("The file path to use as filter for the right node of the relation."),
}).describe(`
    Use leftFilePath and rightFilePath to filter the files when needed. If both are missing, it will return all files that are linked by the given relation.
    Returns: a list of files that are linked by the given relation.
    Example: {"cmd": "query", "relation": "uses"} => 1. /folder/file-1 - uses -> /folder/file-2 \n 2. /folder/file-3 - wears -> /folder/file-4
    Example: {"cmd": "query", "relation": "uses", "leftFilePath": "/folder/file-1"} => 1. /folder/file-1 - uses -> /folder/file-2 \n 2. /folder/file-1 - uses -> /folder/file-3
    Example: {"cmd": "query", "relation": "uses", "rightFilePath": "/folder/file-2"} => 1. /folder/file-1 - uses -> /folder/file-2 \n 2. /folder/file-3 - uses -> /folder/file-2
`.trim());

export const inspectGraphCommandSchema = z.object({
    cmd: z.literal('inspect').describe("Returns the full list of relations between all files in the file system."),
}).describe(`
    Returns: a list of relation types.
    Example: {"cmd": "inspect"} => 1. uses\n 2. wears\n 3. derived_from ...
`.trim());


