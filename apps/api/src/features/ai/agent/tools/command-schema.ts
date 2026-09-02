import { FILE_FORMATS } from '@/features/file-system/constants'
import { z } from 'zod'
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

*/

// ====================== FILE SYSTEM COMMANDS ======================
const filePath = z
  .string()
  .min(1)
  .describe(
    'Absolute file or directory path. Use /root for the root directory.',
  )
const positiveInt = z.number().int().min(1)

export const listCommandSchema = z
  .object({
    cmd: z
      .literal('list')
      .describe('lists the files and directories under a directory'),
    filePathOrId: z
      .string()
      .describe(
        'Absolute file path or file ID (uuid) of the directory to list.',
      ),
  })
  .describe(
    `
    Returns: enumerated list of files and directories under the specified directory path.
    Example: {"cmd": "list", "filepathOrId": "/folder"} => 1. [ID: 9514ac94-7ca8-4efc-a330-8c67bd4c2ee5] - (file) - Name: file-name-1 [format: json] \n 2. [ID: 9514ac94-7ca8-4efc-a330-8c67bd4c2ee6] - (directory) - Name: folder-name-2
    Example: {"cmd": "list", "filepathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5"} => 1. [ID: 9514ac94-7ca8-4efc-a330-8c67bd4c2ee5] - (file) - Name: file-name-1 [format: json]
`.trim(),
  )

export const describeCommandSchema = z
  .object({
    cmd: z
      .literal('describe')
      .describe(
        'Returns information about a file or directory by filepath or file ID. For a file it returns its format and other metadata. For a directory it returns the number of files and directories inside it.',
      ),
    filePathOrId: z.string().describe('Absolute file path or file ID (uuid).'),
  })
  .describe(
    `
    Returns: file [format, is editable, last updated, created at] or directory [children count, is editable, last updated, created at].
    Example: {"cmd": "describe", "filepathOrId": "/folder/file"} => format: text, is editable: true, last updated: 2021-01-01, created at: 2021-01-01
    Example: {"cmd": "describe", "filepathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5"} => format: text, is editable: true, last updated: 2021-01-01, created at: 2021-01-01
`.trim(),
  )

export const createCommandSchema = z
  .object({
    cmd: z.literal('create-file').describe('Creates a new file or directory'),
    parentPathOrId: z
      .string()
      .describe(
        'Absolute file path or file ID (uuid) of the parent directory.',
      ),
    dir: z
      .boolean()
      .default(false)
      .describe('Whether to create a directory or a file'),
    name: z
      .string()
      .min(1)
      .describe(
        'The file/directory name in lowercase separated by underscores for multiple words.',
      ),
    position: z.object({
      anchorFilePathOrId: z
        .string()
        .optional()
        .describe(
          'Absolute file path or file ID (uuid) to anchor the new file to. Only required if insertMode is after or before',
        ),
      insertMode: z
        .enum(['end', 'start', 'after', 'before'])
        .describe('Determines where this new content is placed'),
    }),
  })
  .describe(
    `
    Returns: the new file path.
    Example 1 - file: {"cmd": "create-file", "filepath": "/folder", "dir": false, "name": "file-name", "position": {"anchorFile": "anchor-file-name", "insertMode": "after"}} => /folder/file_name
    Example 2 - directory: {"cmd": "create-file", "filepath": "/folder", "dir": true, "name": "directory-name", "position": {"insertMode": "start"}} => /folder/directory-name
`.trim(),
  )

export const writeCommandSchema = z
  .object({
    cmd: z
      .literal('write')
      .describe(
        'writes to an existing file. This overwrites the entire file content. Use it carefully and only when you are sure you want to overwrite the entire file.',
      ),
    filePathOrId: z
      .string()
      .describe('Absolute file path or file ID (uuid) to write to.'),
    content: z.string().describe('The content to write to the file.'),
    strategy: z
      .enum(['overwrite', 'append'])
      .default('overwrite')
      .describe(
        'The strategy to use to write to the file. overwrite: overwrites the entire file. append: appends the content to the end of the file.',
      ),
  })
  .describe(
    `
    Returns: confirmation message.
    Example 1: {"cmd": "write", "filePathOrId": "/folder/file", "content": "Hello world", "strategy": "overwrite"} => confirmation message that the file has been overwritten with the new content.
    Example 2: {"cmd": "write", "filePathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5", "content": "\nHello world", "strategy": "append"} => confirmation message that the content has been appended to the end of the file.
`.trim(),
  )

export const deleteCommandSchema = z.object({
  cmd: z
    .literal('delete')
    .describe('Delete a file or directory recursively, Equivalent to rm -rf'),
  filePathOrId: z
    .string()
    .describe('Absolute file path or file ID (uuid) to delete.'),
})

export const patchCommandSchema = z
  .object({
    cmd: z
      .literal('patch')
      .describe(
        'replaces a unique text snippet inside a file without rewriting the entire file manually.',
      ),
    filePathOrId: z
      .string()
      .describe('Absolute file path or file ID (uuid) to patch.'),
    oldText: z
      .string()
      .min(1)
      .describe(
        'Exact existing text to replace. It should uniquely identify one location if replaceAll is false, otherwise it should be the entire text to replace.',
      ),
    newText: z.string().describe('The new text.'),
    replaceAll: z
      .boolean()
      .default(false)
      .describe(
        'Replace every occurrence instead of only the first matching one.',
      ),
  })
  .describe(
    `
    Returns: confirmation message.
    Example 1: {"cmd": "patch", "filePathOrId": "/folder/file", "oldText": "old text", "newText": "new text", "replaceAll": false} => confirmation message
    Example 2: {"cmd": "patch", "filePathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5", "oldText": "old text", "newText": "new text", "replaceAll": false} => confirmation message
`.trim(),
  )

export const readCommandSchema = z
  .object({
    cmd: z
      .literal('read')
      .describe(
        'Reads file content with optional line windowing for large files.',
      ),
    filePathOrId: z.string().describe('Absolute file path or file ID (uuid).'),
    offset: z
      .number()
      .int()
      .optional()
      .describe('Optional 1-based starting line number.'),
    limit: positiveInt
      .optional()
      .describe('Optional maximum number of lines to return.'),
  })
  .describe(
    `
    Returns: the full file content or only the requested line range by filepath or file ID.
    Example: {"cmd": "read", "filePathOrId": "/folder/file", "offset": 41, "limit": 20} => lines 41-60 of the file
    Example: {"cmd": "read", "filePathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5", "offset": 41, "limit": 20} => lines 41-60 of the file
`.trim(),
  )

export const moveCommandSchema = z
  .object({
    cmd: z.literal('move').describe('Moves or renames a file or directory.'),
    fileIdOrPath: z
      .string()
      .describe('File ID (uuid) or absolute file path to move.'),
    newParentPathOrId: z
      .string()
      .describe(
        'Absolute file path or file ID (uuid) of the new parent directory.',
      ),
    position: z.object({
      anchorFilePathOrId: z
        .string()
        .optional()
        .describe(
          'Absolute file path or file ID (uuid) to anchor the new file to. Only required if insertMode is after or before',
        ),
      insertMode: z
        .enum(['end', 'start', 'after', 'before'])
        .describe('Determines where this new content is placed'),
    }),
    newName: z
      .string()
      .optional()
      .describe('Optional new name of the file or directory.'),
  })
  .describe(
    `  Returns: confirmation message.
    Example: {"cmd": "move", "fileIdOrPath": "/folder/file", "newParentPathOrId": "/folder/new-folder", "position": {"anchorFilePathOrId": "anchor-file-name", "insertMode": "after"}} => confirmation message
    Example: {"cmd": "move", "fileIdOrPath": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5", "newParentPathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee6", "position": {"anchorFilePathOrId": "anchor-file-name", "insertMode": "after"}} => confirmation message
`.trim(),
  )

export const copyCommandSchema = z
  .object({
    cmd: z
      .literal('copy')
      .describe(
        'Copy the content of a file to another file. It overwrites the existing content of the target file.',
      ),
    fromPathOrId: z
      .string()
      .describe(
        'Absolute file path or file ID (uuid) from which to copy the content.',
      ),
    toPathOrId: z
      .string()
      .describe(
        'Absolute file path or file ID (uuid) to which to copy the content.',
      ),
  })
  .describe(
    `
    Returns: confirmation message.
    Example: {"cmd": "copy", "fromPathOrId": "/folder/file", "toPathOrId": "/folder/new-file"} => confirmation message
    Example: {"cmd": "copy", "fromPathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee5", "toPathOrId": "9514ac94-7ca8-4efc-a330-8c67bd4c2ee6"} => confirmation message
`.trim(),
  )

export const searchCommandSchema = z
  .object({
    cmd: z
      .literal('search')
      .describe(
        'Perform keyword search using PostgreSQL `websearch_to_tsquery` syntax.',
      ),
    keyword: z
      .string()
      .min(1)
      .describe(
        'Search expression. Plain words are AND-ed. Use double quotes for phrases, OR, - to exclude terms.',
      ),
  })
  .describe(
    `
    Returns: ranked chunk hits matching the keyword expression across the whole project.
    Example plain: {"cmd": "search", "keyword": "hero sword"} => matches chunks containing both "hero" AND "sword"
    Example phrase: {"cmd": "search", "keyword": "\\"magic sword\\""} => matches the exact phrase
    Example OR: {"cmd": "search", "keyword": "hero OR protagonist"} => matches either term
    Example NOT: {"cmd": "search", "keyword": "hero -villain"} => hero but not villain
`.trim(),
  )

export const findCommandSchema = z
  .object({
    cmd: z
      .literal('find')
      .describe(
        'Help find a file or directory by name or by format. By format is only supported for files.',
      ),
    name: z
      .string()
      .optional()
      .describe('The name of the file or directory to search for.'),
    format: z
      .enum(FILE_FORMATS)
      .optional()
      .describe('The format of the file to search for.'),
    limit: z
      .number()
      .int()
      .optional()
      .default(15)
      .describe('Optional maximum number of files and directories to return.'),
  })
  .describe(
    `
    Returns: a list of files and directories that match the name or format.
    Example: {"cmd": "find", "name": "file-name", "limit": 10} => 1. (file) file-name-1 [format: json] \n 2. (directory) folder-name-2
    Example: {"cmd": "find", "format": "markdown", "limit": 10} => 1. (file) file-name-1 [format: markdown]
`.trim(),
  )

export const existsCommandSchema = z
  .object({
    cmd: z.literal('exists').describe('Check if a file or directory exists.'),
    filepath: filePath,
  })
  .describe(
    `
    Returns: true if the file or directory exists, false otherwise.
    Example: {"cmd": "exists", "filepath": "/folder/file"} => true
`.trim(),
  )

export const renameCommandSchema = z
  .object({
    cmd: z.literal('rename').describe('Renames a file or directory.'),
    filePathOrId: z
      .string()
      .describe('Absolute file path or file ID (uuid) to rename.'),
    newName: z
      .string()
      .describe(
        'The new name of the file or directory. lowercase separated by underscores for multiple words.',
      ),
  })
  .describe(
    `
    Returns: confirmation message.
    Example: {"cmd": "rename", "filePathOrId": "/folder/file", "newName": "new-file-name"} => confirmation message
`.trim(),
  )
