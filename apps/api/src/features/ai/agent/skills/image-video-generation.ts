export default `
### 1. Common Rules (Image & Video)

1. **Prioritize Project References & Style:**
   - Check project files first for existing characters, locations, props, or style references.
   - Inherit the active project's visual style and world-building unless the user requests otherwise.
   - User-defined skills and explicit user instructions override these defaults.

2. **Ground Real-World Entities:**
   - For real-world people, landmarks, or products, search the web for an authentic visual reference first.
   - Fallback: If no visual reference is found, write an exhaustive physical description before generating.

3. **Targeted Reference Passing:**
   - Attach references **only** for the specific entities present in the current shot. Never blindly attach unrelated project assets.
   - Assign each reference a clear role in the prompt (e.g., "use image 1 for the character's face and outfit, ignore its background") so unassigned traits don't leak.

4. **Re-Anchor to the Source, Not the Last Output:**
   - Always generate from the original anchor/reference—never chain from a previous shot's output, or small errors will compound into identity drift.
   - Never build on a failed or "almost right" output; regenerate from the original reference, changing one variable at a time.
   - If an entity permanently changes state (new outfit, damage, aging), create a new anchor reference for that state rather than prompting the change on top of the old one.

5. **Separate Fixed Traits from Shot Changes:**
   - Describe fixed traits (identity, wardrobe, palette, lighting, lens/look) using identical, concrete wording across related prompts instead of vague phrases like "keep consistent".
   - Vary only what the shot requires: action, pose, framing, and camera.
   - When generating from a base image (I2I or I2V), do not re-describe or contradict what the base image already shows—prompt only what changes or moves.

6. **Prompting & Efficiency Discipline:**
   - Check what the chosen model supports (reference images, first/last frame, negative prompts, duration limits, aspect ratio) and match aspect ratio and resolution up front.
   - Prefer positive phrasing ("empty street") over negative phrasing ("no cars"). Where negative prompts are supported, list concrete artifacts to avoid (e.g., distorted hands, extra limbs, flicker, unwanted text).
   - Do not add extra draft, verification, or re-generation passes on your own. Generate what was requested once, and retry only when the result is clearly broken or the user asks.

---

### 2. Image Generation Rules

1. **Prefer Image-to-Image (I2I) over Text-to-Image (T2I):**
   - Use I2I whenever project references or anchors exist.
   - Use direct T2I only when: (a) the user explicitly requests pure text generation, (b) it is a one-off shot with generic entities and no project context, or (c) you are bootstrapping a new anchor reference.

2. **Bootstrap Missing Recurring Entities with Reference Sheets:**
   - If a new character, location, or prop appears across multiple shots without an existing reference, generate and verify a standalone anchor image first, then pass it into all subsequent shots.
   - Prefer a single **reference sheet** as the anchor: one image showing the entity from the views the planned shots need (e.g., character face close-up + front/side/back/full-body; location from key angles; object from key sides). This keeps views mutually consistent and uses a single reference slot.
   - Keep the sheet clean: neutral background, even lighting, clearly separated non-overlapping views, no text or labels, and only the entity itself (no characters in location sheets).
   - If the sheet's grid/background leaks into outputs, or a close-up needs finer detail, crop or generate a single clean view from the sheet to use as the reference.

3. **Targeted Edits:**
   - When fixing an image, use targeted edit instructions ("change X, preserve everything else") when the model supports them.

---

### 3. Video Generation Rules

1. **Prefer Image-to-Video (I2V) over Text-to-Video (T2V):**
   - Always anchor video generations with a starting frame (\`I2V\`) unless the user explicitly asks for pure \`T2V\` or wants a generic one-off clip with no project context.
   - Lock and verify key still frames first (via \`I2I\` from your entity anchors) before animating them.

2. **Multi-Shot Video from Scratch via a Storyboard Grid Image:**
   - When the user asks directly for a multi-shot/multi-cut video and individual shot images do not exist yet, first generate a single **Storyboard Grid image** whose panel count matches the planned shots (e.g., 2x2 grid for 4 shots, 3x3 grid for 9 shots).
   - **Grid rules:** Every panel must share the same character identity, wardrobe, color palette, and lighting, with clean borders and **no text, labels, or panel numbers** inside the image.
   - **Animate the grid:** Pass that single Storyboard Grid image into the video generator as the visual reference, and write a detailed shot-by-shot prompt mapping each panel in reading order (top-left to bottom-right) with its timing, camera movement, and action (plus "full-screen video, do not show split-screen or grid borders" so the model renders sequential full-frame cuts rather than animating the grid layout).

3. **Batch Existing Short Storyboard Shots into One Multi-Beat Video:**
   - When a storyboard already has individual shot images and 2–3 consecutive short shots (e.g., 2–4s each) share the same scene or subjects, combine them into a single longer video generation (within the model's 10–30s limit) by passing their shot images as references.
   - This speeds up generation, locks lighting and identity across cuts, and lets you direct camera shifts and transitions naturally in one pass.
   - Structure multi-beat prompts with ordered shot blocks (\`Shot 1: [camera + action]. Shot 2: [camera + action].\`) or second-level intervals (\`0-4s: ... 4-8s: ...\`) on models that support exact timestamps (e.g., Seedance 2.5).

4. **Bridge Two Shots with Start + End Frames (\`image\` + \`last_image\`):**
   - When two consecutive shots need a seamless camera move, match-move, or creative transition—and their combined duration fits one clip—pass Shot 1's still as the start frame (\`image\`) and Shot 2's still as the end frame (\`last_image\`).
   - **Compatibility:** Both frames must match in aspect ratio, lighting logic, and subject identity, changing only 1–2 variables (camera distance/angle, pose, or object state). If the two frames are completely different scenes, generate separate clips instead (unless an intentional morph is desired), or the model will force an unnatural morph or abrupt cut.
   - **Prompt the middle, not the endpoints:** Both images already define the start and end states. Prompt only the connecting physical action, motion path, and camera trajectory between Frame A and Frame B as a single continuous take (never combine \`last_image\` with multi-shot cuts).

5. **Single-Take Motion & Camera Discipline:**
   - For single-shot clips, stick to one primary camera movement (or explicitly state \`"locked static camera"\` to prevent unwanted camera drift) and a 2–3 beat physical action chain.
   - Include \`"in a single unbroken continuous take, no cuts"\` on single-shot clips so models with auto-cut features (e.g., Kling) do not split the clip.
   - Only chain from a previous video clip's extracted last frame when one continuous action must exceed the model's max duration; return to original anchor stills at the next camera setup.

6. **Edit-Ready Continuity Across Separate Clips:**
   - **Match screen direction & eyelines (180° rule):** Keep the camera on the same side of the action axis so interacting characters face each other across cuts, and match exit/entry directions (exits frame right -> enters frame left).
   - **Avoid jump cuts:** Consecutive separate clips of the same subject should change shot scale by at least one clear step (e.g., \`Wide Shot\` -> \`Medium Close-Up\`) or shift camera angle by >30°.

7. **Native Audio & No On-Screen Text:**
   - When audio generation is enabled, direct sound in a dedicated sentence: spoken dialogue, contact foley tied to visible actions, ambient room tone, and \`"no background music"\` when only natural sound is wanted.
   - Do not rely on video models to render on-screen text or logos (they warp during motion). Always add \`"no subtitles, no on-screen text, no watermark"\` so spoken dialogue doesn't trigger burned-in captions; add typography in post.

---

### Examples

#### Example 1: Existing Project Character (Image)
* **User:** "Show Marcus running through the neon marketplace."
* **Context:** Project contains \`marcus_reference.png\` and \`neon_market_bg.png\`.
* **Action:** \`Image-to-Image (I2I)\` attaching \`marcus_reference.png\` and \`neon_market_bg.png\` in the project's neon-noir style.

#### Example 2: New Recurring Character (Image Sequence)
* **User:** "Create a 3-part storyboard introducing Captain Vane, an old space pirate with a cybernetic eye."
* **Context:** No existing references for Captain Vane.
* **Action:**
  1. Generate a clean reference sheet \`captain_vane_ref.png\` (\`T2I\`: face close-up + front, side, back, full-body views showing the cybernetic eye) and verify it.
  2. Generate Shots 1, 2, and 3 via \`I2I\` anchored to \`captain_vane_ref.png\` (never chaining Shot 1 -> Shot 2 -> Shot 3).

#### Example 3: Generic One-Off (Image)
* **User:** "Generate a generic coffee cup on a wooden table."
* **Context:** No project world or recurring asset.
* **Action:** \`Text-to-Image (T2I)\` with no references attached.

#### Example 4: Real-World Entity (Video)
* **User:** "Show the Eiffel Tower at sunset, but as a video."
* **Context:** Real-world landmark; no project reference.
* **Action:**
  1. Retrieve or generate a high-fidelity still of the Eiffel Tower at sunset.
  2. Animate via \`Image-to-Video (I2V)\` using that still, prompting only the motion (drifting clouds, shifting light, one slow camera move) in a single unbroken take.

#### Example 5: Storyboard-to-Video (Batching & Frame Bridging)
* **User:** "Animate our 3 storyboard shots: Shot 1 (3s, wide shot of Marcus entering the alley), Shot 2 (3s, medium close-up pushing in as he spots a drone), Shot 3 (4s, Marcus ducks behind a crate)."
* **Context:** Stills \`shot1.png\`, \`shot2.png\`, and \`shot3.png\` are already generated on the storyboard.
* **Action:**
  - **Option A — Smooth Transition Bridge (Start + End Frame):** Pass \`shot1.png\` as \`image\` and \`shot2.png\` as \`last_image\` for a 6s \`I2V\` clip, prompting the middle path: *"Camera dollies in smoothly from wide to medium close-up as Marcus steps into the alley, freezes, and looks up toward the buzzing drone; wet neon reflections steady, single continuous take."*
  - **Option B — Multi-Shot Batch:** Pass \`shot1.png\`, \`shot2.png\`, and \`shot3.png\` as reference images into a single 10s multimodal video call, directing each beat: *"Shot 1 (0-3s): Wide tracking shot using @Image1 as Marcus enters the alley. Shot 2 (3-6s): Cut to medium push-in using @Image2 as he spots the drone overhead. Shot 3 (6-10s): Handheld low angle using @Image3 as he ducks behind the crate."*

#### Example 6: Multi-Shot Video from Scratch via a Storyboard Grid
* **User:** "Generate a 12-second commercial video with 4 cuts: a runner lacing up shoes at dawn, sprinting down a wet city street, a close-up of the shoe splashing through a puddle, and stopping on a bridge overlooking the sunrise."
* **Context:** No individual shot images exist yet.
* **Action:**
  1. Generate a single 2x2 **Storyboard Grid image** (\`runner_grid_2x2.png\`) showing the 4 shots in reading order with consistent runner identity, outfit, and dawn color palette, with no text or labels.
  2. Pass \`runner_grid_2x2.png\` into the video generator and prompt each cut sequentially: *"Full-screen sequential video following the 4 panels of @Image1 in reading order (do not show grid borders or split-screen). Shot 1 (0-3s, top-left panel): Low-angle close-up, hands pull shoelaces tight, morning mist. Shot 2 (3-6s, top-right panel): Wide tracking shot following the runner sprinting down the wet asphalt street. Shot 3 (6-9s, bottom-left panel): Slow-motion extreme close-up as the shoe strikes a puddle, water droplets bursting outward. Shot 4 (9-12s, bottom-right panel): Medium crane-up shot as the runner stops at the bridge railing, breathing heavily into the golden sunrise."*
`.trim()
