export default `
### Core Rules

1. **Prioritize Project References & Style:**
   - Always check the project files first for characters, locations, or props mentioned by the user.
   - If no specific style is requested, automatically inherit the active project's visual style/world-building.
   - User-defined skills and explicit user preferences override these general defaults.

2. **Ground Real-World Entities:**
   - If the request includes a specific real-world person, landmark, or product, search the web for an authentic visual reference.
   - Fallback: If no reference is found, write an exhaustive physical description before generating.

3. **Generation Hierarchy (Consistency First):**
   - **Image:** Prefer Image-to-Image (I2I) over Text-to-Image (T2I).
   - **Video:** Prefer Image-to-Video (I2V) over Text-to-Video (T2V).
   - Check what the chosen model supports (reference images, first/last frame, negative prompts, duration limits) and adapt the approach to it.

4. **Bootstrap Missing Recurring Entities:**
   - If a new entity appears across multiple planned shots but lacks a reference, generate a standalone "anchor/reference image" first. Pass this anchor into all subsequent generations.
   - Prefer a single **reference sheet** as the anchor: one image showing the entity from several relevant views (e.g., a character's face close-up plus front, side, back and full-body; a location from a few angles; an object from its key sides). Generating the views together keeps them consistent with each other and uses only one reference slot.
   - Keep the sheet clean: neutral background, even lighting, views clearly separated and not overlapping, no text or labels, and nothing but the entity itself (locations: no characters). Choose only the views the planned shots will need.
   - If the sheet's layout, background, or panel structure leaks into outputs, or a shot needs more fine detail than the sheet gives (e.g., a close-up), crop or generate a single clean view from the sheet and use that as the reference for those shots.
   - Review the anchor before building on it. Everything downstream inherits its flaws.

5. **Targeted Reference Passing:**
   - Attach references **only** for the specific entities present in the current frame. Never blindly attach irrelevant project assets.
   - Give each reference a clear job in the prompt (e.g., "use image 1 for the character's face and outfit, ignore its background"), so unassigned references don't leak unwanted content.

6. **Re-Anchor to the Source, Not the Last Output:**
   - For each new shot or setup, go back to the original anchor/reference. Do not use a previous output as the reference for the next one, since small errors compound into identity drift.
   - Never build on a failed or "almost right" output. Regenerate from the original reference.
   - Exception: chain from the last frame only when one continuous action must extend beyond a single clip's length. Return to the original references at the next new setup.
   - If an entity legitimately changes (new outfit, damage, aged), create a new reference for that state rather than describing the change on top of the old one.

7. **Separate What Stays Fixed from What Changes:**
   - Describe fixed traits (identity, wardrobe, palette, lighting character, lens/look) consistently and with the same wording across a related set of generations. List concrete features rather than saying "keep consistent".
   - Vary only what the shot needs: action, pose, framing, camera.
   - When the image is the base (I2I / I2V), don't re-describe what it already shows or contradict it. Prompt only what should change or move.

8. **Video Shot Discipline:**
   - Keep clips short, with one main action and at most one primary camera movement. Split complex sequences into multiple shots.
   - Describe motion concretely (what moves, in what order, how the camera behaves) rather than with vague words.
   - Where supported, anchor both the first and last frame for controlled transitions, and make sure the two frames are compatible in subject, framing, and lighting.
   - Match aspect ratio and resolution to the intended use up front. Don't rely on exact on-screen text in video; add text in post.

9. **Phrase Constraints Carefully:**
   - Prefer positive phrasing ("empty street") over negatives ("no cars").
   - Where negatives are supported, name concrete artifacts to avoid (e.g., distorted hands, extra limbs, flicker, unwanted text) rather than vague quality words.

10. **Plan Multi-Shot Work and Fix Problems Efficiently:**
    - For multi-shot work, lock the key still frames first, then animate them.
    - Do not add extra verification, draft, or re-generation passes on your own. Generate what was requested once, and only draft, review in depth, or retry when the user asks or the result is clearly broken.
    - When a problem has to be fixed, change one variable at a time and regenerate from the original references. Use targeted edits ("change X, preserve everything else") when the model supports them.

11. **When to Use Direct Text-to-Image/Video (T2I / T2V):**
    - The user explicitly requests pure text generation.
    - The generation is a one-off shot with generic entities (e.g., "a red sports car on an empty highway", "a silhouette in the rain") with no project context.


### Examples

#### Example 1: Existing Project Character
* **User:** "Show Marcus running through the neon marketplace."
* **Context:** Project contains \`marcus_reference.png\` and \`neon_market_bg.png\`.
* **Action:** 
  - Mode: \`Image-to-Image (I2I)\`
  - References attached: \`marcus_reference.png\`, \`neon_market_bg.png\`
  - Style: Match current project neon-noir aesthetic.

#### Example 2: New Recurring Character
* **User:** "Create a 3-part storyboard introducing Captain Vane, an old space pirate with a cybernetic eye."
* **Context:** No existing references for Captain Vane.
* **Action:**
  1. Generate a standalone reference sheet: \`captain_vane_ref.png\` (T2I; face close-up plus front, side, back and full-body views, including the cybernetic eye) and verify it.
  2. Generate Scene 1 using \`captain_vane_ref.png\` (I2I).
  3. Generate Scene 2 using \`captain_vane_ref.png\` (I2I), not Scene 1's output.
  4. Generate Scene 3 using \`captain_vane_ref.png\` (I2I), not Scene 2's output.

#### Example 3: Real-World Entity
* **User:** "Show the Eiffel Tower at sunset, but as a video."
* **Context:** Real-world landmark; no project reference.
* **Action:**
  1. Retrieve/generate a high-fidelity image reference of the Eiffel Tower at sunset.
  2. Use \`Image-to-Video (I2V)\` using that base image. The prompt describes only the motion (drifting clouds, shifting light, one slow camera move), not the scene again.

#### Example 4: Generic One-Off
* **User:** "Generate a generic coffee cup on a wooden table."
* **Context:** No project world attached, no recurring asset.
* **Action:**
  - Mode: \`Text-to-Image (T2I)\`
  - References attached: None.

#### Example 5: Multi-Shot Video Sequence
* **User:** "Make a 3-shot video of Marcus entering the market, then turning, then looking up."
* **Context:** Project contains \`marcus_reference.png\`.
* **Action:**
  1. Generate a still for each shot from \`marcus_reference.png\` (I2I), keeping the fixed traits wording identical and varying only pose and framing. Review them.
  2. Animate each still as its own short clip (I2V), each with one action and one camera move.
  3. If a shot fails, regenerate it from its still and \`marcus_reference.png\`, not from the failed clip.
`
