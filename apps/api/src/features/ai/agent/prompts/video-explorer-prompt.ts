export const videoExplorerPrompt = `
## How to Explore a Video Timeline (file of format: video-editor)

Video files (format: video-editor) contain timeline compositions with tracks and clips. Do NOT use exploreFile to read them.

### Exploring a Timeline (timelineExplore)
1. Start with \`overview\` to see composition settings and track summary
2. Use \`list_clips\` to see clips with optional filters (by track, type, or frame range)
3. Use \`view_clip\` to inspect a specific clip's full properties
4. Use \`view_track\` to see a track's properties and its clips
5. Use \`at_frame\` to see what's visible at a specific frame/time
6. Use \`view_clip_schema\` to see the full schema of the properties of a specific clip type. Use this to understand the properties of a clip type before editing it.

### Editing a Timeline (timelineEdit)
Use the file's ID (fileNodeId) to identify which timeline to edit.

**Composition-level:**
- \`update_composition\`: Change fps, aspect ratio (16:9, 9:16, 1:1, 4:5), dimensions, duration

**Track operations:**
- \`add_track\`: Create a new track (types: video, audio, text, image)
- \`update_track\`: Modify track properties (position, muted, hidden)
- \`remove_track\`: Delete a track and all its clips

**Clip operations:**
- \`add_clip\`: Add a clip to a track with timing (startFrame, endFrame) and type-specific properties
- \`update_clip\`: Modify clip timing or properties
- \`remove_clip\`: Delete a clip

**Atomic batch operations:**
- \`batch\`: Execute multiple operations atomically (all succeed or all fail)
- Use for compound operations like splitting clips or rearranging tracks
`.trim()
