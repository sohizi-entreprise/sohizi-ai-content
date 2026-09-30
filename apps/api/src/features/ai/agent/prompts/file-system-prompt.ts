import { FILE_FORMATS, FILE_TYPES } from "@/features/file-system/constants"
import { formatFileTag } from "@/lib/file-tag"

const fileTagExample = formatFileTag({
  displayName: "my-file",
  path: "/root/scripts/my-file",
})

export const fileSystemPrompt = `
## file_system

### Structure
- All files are stored under a root directory: \`/root\`
- Use absolute paths starting with \`/root/\` (e.g., \`/root/scripts/episode_1\`)
- Maximum directory depth: 5 levels

### File Types and Formats
Every file has a **type** (what it is) and a **format** (how the content is stored).

Types: ${FILE_TYPES.join(", ")}
Formats: ${FILE_FORMATS.join(", ")}

| Type | Default format | Description | How to Work With It |
|------|----------------|-------------|---------------------|
| document | markdown | Text documents, scripts, notes, json, html, pdf, or other files | Read/write markdown documents with exploreFile/editFile |
| storyboard | markdown | Scene and shot breakdown | Read/write with exploreFile/editFile using world-bible YAML front matter plus \`:::scene\` / \`:::shot\` container markdown |
| skill | markdown | Instruction sets for specific tasks | Read/write with exploreFile/editFile. Call fileSyntaxTool before the first write or patch |
| image | file | Image asset | Read metadata via exploreFile |
| video | file | Video asset | Read metadata via exploreFile |
| audio | file | Audio asset | Read metadata via exploreFile; transcribe with processSpeech |
| video-editor | json | Video timeline composition | Use timelineExplore and timelineEdit tools (NOT exploreFile) |

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

### Syntax Guidelines

1. File Reference Syntax:
Universal file tag (documents, skills, and chat):
[Display Name](/root/path/to/file)

The full selected text is provided separately in \`<attached_selections>\` — do not treat the compact file tag as the complete citation.

example (file mention): ${fileTagExample}

2. Our file naming convention is: file_name or file-name.
- There is NO .format extension in the file name, because the format is already defined on the file level.
- Use underscores or hyphens to separate words in the file name.
- Avoid: spaces, uppercase letters, or any other special characters in the file name.

`.trim()

// ### Storyboard syntax
// Storyboard files are nested container markdown. Preserve existing scene and shot \`id\` values when patching. Example:

// :::scene
// id: scene-1
// title: Arrival
// description: A detective enters an abandoned warehouse.

// :::shot
// id: shot-1
// number: 1
// action: Wide establishing shot of the warehouse.
// :::
// :::
