export const navigateContextPrompt = `
## CONTEXT MANAGEMENT INSTRUCTIONS

Your primary tool for understanding the project and maintaining a 360-degree view is the "context" file chain. You must maintain this chain as the project grows. 
**Users can modify files and context documents independently at any time.** You must use your tools to view the actual directory state, using the context files to understand the *meaning* and *relationships* of those files.

### 1. Core Contract & Creation
A "context" file concisely explains its folder's purpose and indexes its children.
- **Index Format**: \`- {file/folder name} [ID: {file_id}] : {concise description}\`
- **On-Demand Creation**: Do NOT create a context file in every directory. Create one ONLY when a folder introduces a distinct subsystem, a standalone workflow, or acts as a crucial architectural boundary.
- **Root Context**: The root context is located at \`/root/core/context\` and is automatically loaded into your memory. 
- **Inheritance & Bloat**: Subdirectories inherit rules from their parents. Keep context files lightweight. If a parent context file becomes bloated, refactor it by moving specific details into child context files.

### 2. Read & Verify Before Acting
Information in a context file may be stale due to independent user edits. Always verify state.
1. **Trace**: Walk from the repository root to each target path, reading the context files found along the route.
2. **Verify**: Use your file-system tools to list the actual contents of the directory. Compare this reality against the context file's index. 
3. **Resolve**: If a file is missing, changed, or new files exist, the *actual file system* is the source of truth. Immediately update the context file to fix the staleness before proceeding with your task.
4. **Hierarchy**: Use the nearest context file as the local contract. If docs conflict, the closer context file overrides parent docs.

### 3. Update After Editing
Every meaningful change you make requires an update to the relevant context files before the task is complete.
- **Strict Scope Limitation**: Confine your context updates strictly to the affected file/folder's immediate parent. Do NOT perform project-wide or cascading updates. For example, if you modify \`Folder_A/File_B\`, you must only update the context file inside \`Folder_A\`.
- **Update Triggers**: Modify the immediate parent context file when changing:
  - Purpose, scope, responsibilities, or workflows.
  - File structure (creation, deletion, renames) to keep the \`[ID: file_id]\` index accurate.
- **Moves & Cross-Folder Changes**: If moving a file, you must update exactly *two* context files: the source directory's context (to remove it) and the destination directory's context (to add it).
- **Propagation Exception**: Only touch a higher-level parent context file if your local change fundamentally breaks or alters a broader architectural rule explicitly stated in that parent. Otherwise, leave parent contexts untouched.
- **Threshold**: Minor edits (e.g., typo fixes, formatting, or internal logic tweaks that do not alter a file's purpose or inputs/outputs) do NOT require context updates. Leave the context file untouched.

### 4. Writing Style
- Keep docs concise, current, and strictly operational.
- Document stable contracts, not historical changelogs or diary entries.
- Put broad rules in parent docs and concrete details in child docs.
- Use direct bullet points with explicit names and correct Database IDs.
- Delete stale notes instead of explaining their history. Trim obvious statements.

### 5. Task Closeout
- Verify that all newly created, moved, or deleted paths are accurately reflected in the nearest context index.
- Ensure the local context chain remains unbroken and understandable.
- Remove any stale text, contradictory rules, or broken IDs from the specific context files you touched.
- If you find context files out-of-sync due to user edits correct them.
`.trim()
