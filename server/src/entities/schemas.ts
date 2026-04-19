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
*/

// ====================== FILE SYSTEM COMMANDS ======================
const filePath = z.string().min(1).describe("Absolute file or directory path. Use / for the root directory.");
const positiveInt = z.number().int().min(1);

export const listCommandSchema = z.object({
    cmd: z.literal('ls').describe("lists the contents of a directory specified by the file path"),
    filepath: filePath,
}).describe(`
    Returns: enumerated list of files and directories under the specified directory path.
    Example: {"cmd": "ls", "filepath": "/folder"} => 1. (file) file_id1 [format: text/json] \n 2. (directory) folder_id2 [format: text/json]
`.trim());

export const statCommandSchema = z.object({
    cmd: z.literal('stat').describe("Returns the metadata of the file or directory specified by the given file path."),
    filepath: filePath,
}).describe(`
    Returns: metadata of the file or directory specified by the given file path.
    - for file: lines number, words count, format
    - for directory: number of files
    Example: {"cmd": "stat", "filepath": "/folder/file_id"} => words count: 100, lines number: 10, format: text
`.trim());

export const touchCommandSchema = z.object({
    cmd: z.literal('touch').describe("Creates a new file"),
    filepath: filePath,
    fname: z.string().min(1).describe("The name of the file to create"),
}).describe(`
    Returns: the new file id.
    Example: {"cmd": "touch", "filepath": "/folder", "fname": "file_name"} => file_id
`.trim());

export const mkdirCommandSchema = z.object({
    cmd: z.literal('mkdir').describe("Creates a new directory recursively. Equivalent to mkdir -p"),
    filepath: filePath,
}).describe(`
    Returns: the new directory id.
    Example: {"cmd": "mkdir", "filepath": "/folder"} => folder_id
`.trim());

export const catCommandSchema = z.object({
    cmd: z.literal('cat').describe("Returns the content of a file."),
    filepath: filePath,
}).describe(`
    Returns: the content of the file.
    Example: {"cmd": "cat", "filepath": "/folder/file_id"} => file content
`.trim());

export const readCommandSchema = z.object({
    cmd: z.literal('read').describe("Reads file content with optional line windowing for large files."),
    filepath: filePath,
    offset: z.number().int().optional().describe("Optional 1-based starting line number."),
    limit: positiveInt.optional().describe("Optional maximum number of lines to return."),
}).describe(`
    Returns: the full file content or only the requested line range.
    Example: {"cmd": "read", "filepath": "/folder/file_id", "offset": 41, "limit": 20} => lines 41-60 of the file
`.trim());

export const diffCommandSchema = z.object({
    cmd: z.literal('diff').describe("Compares the content of two files and returns the textual differences."),
    filepath: filePath,
    compareToPath: filePath.describe("The second file path to compare against."),
}).describe(`
    Returns: a diff showing the changes between two files.
    Example: {"cmd": "diff", "filepath": "/folder/file_a", "compareToPath": "/folder/file_b"} => @@ -1,2 +1,2 @@ ...
`.trim());

export const mvCommandSchema = z.object({
    cmd: z.literal('mv').describe("Move or rename files or directories."),
    fromPath: filePath,
    toPath: filePath,
});

export const rmCommandSchema = z.object({
    cmd: z.literal('rm').describe("Delete a file or directory recursively, Equivalent to rm -rf"),
    filepath: filePath,
});

export const grepCommandSchema = z.object({
    cmd: z.literal('grep').describe("Perform exact text or keyword search in a file or directory."),
    filepath: filePath,
    keywords: z.array(z.string()).min(1).describe("Exact text keywords or phrases to search for."),
}).describe(`
    Returns: matching lines or file hits for the provided exact text keywords.
    Example: {"cmd": "grep", "filepath": "/folder", "keywords": ["TODO", "Scene 4"]} => matching lines and file paths
`.trim());

export const searchCommandSchema = z.object({
    cmd: z.literal('search').describe("Perform semantic search in a file or directory using a natural-language query."),
    filepath: filePath,
    query: z.string().min(1).describe("Semantic search query describing the meaning you want to find."),
}).describe(`
    Returns: files or passages that are semantically relevant to the query.
    Example: {"cmd": "search", "filepath": "/folder", "query": "scenes where the hero gives up"} => relevant files or excerpts
`.trim());

export const existsCommandSchema = z.object({
    cmd: z.literal('exists').describe("Check if a file or directory exists."),
    filepath: filePath,
}).describe(`
    Returns: true if the file or directory exists, false otherwise.
    Example: {"cmd": "exists", "filepath": "/folder/file_id"} => true
`.trim());

export const writeCommandSchema = z.object({
    cmd: z.literal('write').describe("Creates or fully overwrites a file with the provided content."),
    filepath: filePath,
    content: z.string().describe("Full file content to write."),
}).describe(`
    Returns: the written file path or id.
    Example: {"cmd": "write", "filepath": "/folder/file_id", "content": "Hello"} => /folder/file_id
`.trim());

export const replaceCommandSchema = z.object({
    cmd: z.literal('replace').describe("Replaces a unique text snippet inside a file without rewriting the entire file manually."),
    filepath: filePath,
    oldString: z.string().min(1).describe("Exact existing text to replace. It should uniquely identify one location."),
    newString: z.string().describe("Replacement text."),
    replaceAll: z.boolean().default(false).describe("Replace every occurrence instead of only the first matching one."),
}).describe(`
    Returns: the updated file path or id.
    Example: {"cmd": "replace", "filepath": "/folder/file_id", "oldString": "draft", "newString": "final"} => /folder/file_id
`.trim());

// ====================== PROJECT BRIEF COMMANDS ======================






export const projectBriefSchema = z.object({
    format: z.string().min(1).describe("The format of the content (e.g., 'screenplay', 'short film', 'series episode')"),
    genre: z.string().min(1).describe("The primary genre of the story (e.g., 'drama', 'thriller', 'comedy')"),
    durationMin: z.number().min(1).describe("The estimated runtime in minutes"),
    tone: z.array(z.string()).min(1).describe("The tonal qualities of the story (e.g., ['dark', 'suspenseful', 'emotional'])"),
    audience: z.string().min(1).describe("The target audience for the content (e.g., 'general', 'mature', 'young adult')"),
    storyIdea: z.string().min(1).describe("The initial idea or premise that will be developed into a full script"),
});

export const artifactTypeSchema = z.enum(['story_bible', 'synopsis', 'outline', 'narrative_arcs', 'requirements']);
export const artifactStatusSchema = z.enum(['ready', 'failed', 'need-approval', 'unset']);

export const narrativeArcSchema = z.object({
    title: z.string().min(1).describe("The working title of the concept"),
    logline: z.string().min(1).describe("One sentence that captures the essence of the story"),
    synopsis: z.string().min(1).describe("2-3 paragraph narrative arc description"),
    genre: z.array(z.string()).min(1).describe("The genres that apply to this concept (e.g., ['drama', 'thriller'])"),
    tone: z.array(z.string()).min(1).describe("The tonal qualities (e.g., ['dark', 'suspenseful'])"),
    themes: z.array(z.string()).describe("The thematic elements explored in the story (e.g., ['redemption', 'family'])"),
    source: z.enum(["agent", "user"]).describe("Whether this concept was generated by the AI agent or provided by the user. Always 'agent' for AI-generated concepts."),
    isSelected: z.boolean().describe("Whether this concept has been selected by the user to develop further. Always false for newly generated concepts."),
  });

export const narrativeArcListSchema = z.array(narrativeArcSchema);

export const storyBibleSchema = z.object({
    world: z.object({
        setting: z.string().min(1).describe("The primary location or world where the story unfolds (e.g., 'Chicago', 'Small coastal town')"),
        timePeriod: z.string().min(1).describe("When the story takes place (e.g., 'Present day', '1920s', 'Near future')"),
        worldRules: z.string().describe("A very concise rules or logic that govern the world (magic, tech, social norms).(2-3 sentences)"),
        socialContext: z.string().describe("A very concise of the social structure, power dynamics, and cultural context.(2-3 sentences)"),
    }),
    conflictEngine: z.object({
        centralConflict: z.string().describe("The main opposing forces or dilemma driving the plot"),
        stakes: z.string().describe("What can be won or lost; consequences of failure"),
        antagonisticForce: z.string().describe("Who or what opposes the protagonist"),
        timePressure: z.string().describe("Deadlines, ticking clocks, or urgency"),
        mainDramaticQuestion: z.string().describe("The story question the audience wants answered (e.g., 'Will they escape?')"),
    }),
    toneAndStyle: z.object({
        visualStyle: z.string().describe("Look and feel (e.g., noir, documentary, high contrast)"),
        dialogueStyle: z.string().describe("How characters speak (e.g., naturalistic, stylized, sparse)"),
        pacing: z.string().describe("Rhythm of the story (e.g., slow burn, propulsive, episodic)"),
    }),
    continuityRules: z.object({
        factsToConsistent: z.string().describe("A very concise established facts that must stay consistent"),
        characterBehaviorRules: z.string().describe("A very concise how characters should act and react consistently"),
        thingsToAvoid: z.string().describe("A very concise contradictions or mistakes to avoid"),
    }),
})

export const outlineSchema = z.object({
    structureType: z.string().describe("The structure type of the outline. e.g. 3 acts 15 beat sheet, AIDA, etc."),
    content: z.string().describe("The content of the outline"),
});

export const synopsisSchema = z.object({
    title: z.string().describe("The title of the synopsis"),
    paragraphs: z.array(z.string()).describe("The paragraphs of the synopsis"),
})

export const requirementsSchema = z.object({
    targetDuration: z.number().min(1).describe("The target duration of the story in minutes"),
    maxNumberOfScenes: z.number().min(1).describe("The maximum number of scenes in the story"),
    targetAudience: z.enum(['general', 'kids', 'teens', 'adult']).describe("The target audience for the story"),
    targetPlatform: z.enum(['YouTube', 'TikTok', 'Instagram', 'Facebook', 'Twitch', 'Discord', 'Reddit', 'Other']).describe("The target platform for the story. e.g. YouTube, TikTok, Instagram, etc."),
    aspectRatio: z.enum(['16:9', '4:3', '1:1', '9:16', '21:9', '1:21']).describe("The aspect ratio of the final video"),
    audioStrategy: z.array(z.enum(['music+subtitle', 'voiceover', 'sound effects', 'narration', 'dialogue'])).describe("Will this use an AI Voiceover, on-camera dialogue, or just music + sound effects?"),
    contentGuardrails: z.string().describe("A very concise guardrails or rules that must be followed when writing the content"),
    otherRequirements: z.string().describe("Other requirements that must be followed when writing the content. e.g. no swearing, no violence, no sex, no drugs, etc."),
})

export const artifactSchema = z.object({
    type: artifactTypeSchema,
    status: artifactStatusSchema,
    description: z.string().min(1).describe("The description of the artifact"),
    jsonContent: z.record(z.string(), z.unknown()).describe("The JSON content of the artifact"),
    proseContent: proseDocumentSchema.describe("The prose content of the artifact"),
});