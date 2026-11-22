export default `
User instructions and user-defined skills override these rules.

Prerequisite reading:
- \`/system/syntax/storyboard\` before creating or editing a storyboard file.
- \`/system/skills/image-video-generation\` before generating any image.

Execute strictly in this order: **1. World -> 2. Full Text -> 3. References -> 4. Shot Images -> 5. Review.**

### 1. Define the World
- Inspect project files for the brief, characters, locations, props, and existing references.
- Ask the user only if a missing detail would change the entire project.
- Define the storyboard's world-bible front matter (\`aspectRatio\`, \`visualStyle\`, \`colorPalette\`, \`temporalContext\`) and keep fixed traits consistent across every prompt.

### 2. Write All Text Before Any Image Generation
- Create a storyboard file with \`type: "storyboard"\` (or update the existing storyboard file in place) and write the complete storyboard (all scenes and shots) before generating any images.
- Every shot must include \`action\`, \`shotType\`, and \`camera\` (\`angle\` + \`movement\`).
- **Sound:** Decide from the brief whether the project uses \`narration\`, \`dialogue\`, or both, and write short, natural lines sized to each shot. If intentionally silent, state that in the scene \`action\`.
- Read through once to verify story arc, pacing, and sound coverage before moving on.

**Shot Types (\`shotType\`)**
- \`Extreme Close-Up\` (ECU): Eyes only or small detail — intense emotion, key detail reveal.
- \`Close-Up\` (CU): Face fills frame — emotion, reaction, intimate dialogue.
- \`Medium Close-Up\` (MCU): Head and shoulders — conversations, interviews.
- \`Medium Shot\` (MS): Waist up — general dialogue and action.
- \`Medium Long Shot\` (MLS): Knees up — walking, casual interaction.
- \`Long Shot\` (LS): Full body — character in their environment.
- \`Wide Shot\` (WS): Environment dominant — establishing location and scale.
- \`Extreme Wide Shot\` (EWS): Vast landscape — epic scope, isolation, transitions.

**Camera Angles (\`camera.angle\`)**
- \`Eye Level\`: Neutral, natural — default for most scenes.
- \`High Angle\`: Subject looks small/vulnerable — weakness, overview.
- \`Low Angle\`: Subject looks powerful/dominant — authority, heroism, threat.
- \`Bird's Eye\`: Overhead view — geography, layout, scale.
- \`Worm's Eye\`: Ground-level looking up — extreme power, awe, towering figures.
- \`Dutch Angle\`: Tilted horizon — unease, tension, disorientation, chaos.
- \`Over-the-Shoulder (OTS)\`: Behind one character looking at another — conversations, POV connection.

**Camera Movement (\`camera.movement\`)**
- \`Static\`: Fixed camera — stability, observation, controlled tension.
- \`Pan\`: Horizontal rotation — scanning, following, revealing.
- \`Tilt\`: Vertical rotation — revealing height or power.
- \`Dolly\`: Moves toward/away from subject — intimacy (push in) or distance (pull out).
- \`Truck\`: Moves laterally — tracking alongside action, lateral reveal.
- \`Crane/Jib\`: Moves vertically up/down — grand reveals, transitions.
- \`Zoom\`: Focal length shift — rapid focus change, dramatic emphasis.
- \`Steadicam/Gimbal\`: Smooth tracking — immersion, following movement.
- \`Handheld\`: Subtle shake — urgency, realism, chaos.

### 3. Build References
- Follow \`/system/skills/image-video-generation\` to create and verify reference anchors for recurring characters, locations, or props (plus an optional style frame) before generating shot images.
- If an anchor is flawed, fix the anchor—do not patch around it in shot prompts.

### 4. Generate and Attach Shot Images Batch by Batch (Scene by Scene)
- Work batch by batch (scene by scene): generate all shot images for the current scene within the concurrency limit, save the assets, and attach their URLs to the shots' \`image\` fields in the storyboard file before moving on to the next scene. Do not pause for user confirmation between scenes.
- Build each prompt from the shot (\`action\`, \`shotType\`, \`camera\`), scene (\`environment\`, \`lighting\`), and world bible. If a generated image improves a shot, update the shot text to match.
- Strictly avoid regenerating the same shot image more than once if a generation fails or produces a malformed image, as repeated retries hurt the project's image budget. If a single retry from the original references fails, skip it and continue.

### 5. Review
- Check story flow, continuity, sound coverage, and image-to-text match. Make targeted fixes only—no extra polish passes.
- Summarize the board, list any shots missing an image, and note key assumptions.
`.trim()
