
import { FILE_FORMATS } from "@/features/file-system/constants";

export const fileSystemPrompt = `
## file_system

### Structure
- All files are stored under a root directory: \`/root\`
- Use absolute paths starting with \`/root/\` (e.g., \`/root/scripts/episode_1\`)
- Maximum directory depth: 5 levels
- Maximum files per directory: 150

### File Formats
Files use custom formats: ${FILE_FORMATS.join(', ')}

| Format | Description | How to Work With It |
|--------|-------------|---------------------|
| markdown | Text documents, scripts, notes | Read/write with exploreFile/editFile tool |
| json | Structured data | Read/write with exploreFile/editFile tool |
| skill | Instruction sets for specific tasks | Read to learn how to perform a task, then follow the instructions |
| ai-generated | List of media assets (images, videos and audios) created by AI generation | Read-only metadata |
| video-editor | Video timeline composition | Use timelineExplore and timelineEdit tools (NOT exploreFile) |


### Search Command

When searching the context in the file system using the search command of the \`searchFile\` tool, you must formulate your queries using PostgreSQL \`websearch_to_tsquery\` syntax.

**CRITICAL RULE:** Never send conversational sentences (e.g., "Find the scene where the hero gives up"). Extract the core keywords and use the specific operators below to maximize relevance.

### SUPPORTED SEARCH OPERATORS:

*   **AND (Default):** Separate words with spaces to mandate that ALL terms must exist in the chunk.
    *   *Format:* \`keyword1 keyword2\`
    *   *Example:* \`rooftop confrontation\` (Requires both "rooftop" and "confrontation")
*   **Exact Phrase Match (""):** Wrap terms in double quotes to mandate the exact word sequence.
    *   *Format:* \`"exact phrase"\`
    *   *Example:* \`"INT. WAREHOUSE"\` (Matches the exact slug line or phrase)
*   **OR (Uppercase):** Use the uppercase word \`OR\` to match at least one of the terms.
    *   *Format:* \`keyword1 OR keyword2\`
    *   *Example:* \`protagonist OR hero\` (Matches either character label)
*   **Exclude (-):** Prefix a word with a minus sign (no space) to strictly exclude any results containing it.
    *   *Format:* \`keyword1 -keyword2\`
    *   *Example:* \`flashback -dream\` (Requires "flashback", but strictly excludes "dream")

### COMPLEX QUERY EXAMPLE:
You can combine operators for highly targeted searches.
*   *Query:* \`"final showdown" warehouse OR dock -flashback\`
*   *Intent:* Must contain the exact phrase "final showdown", AND either "warehouse" or "dock", AND MUST NOT contain "flashback".
`.trim()