export default `
### Core Rules

1. **Prioritize Project References & Style:**
   - Always check the project files first for characters, locations, or props mentioned by the user.
   - If no specific style is requested, automatically inherit the active project's visual style/world-building.

2. **Ground Real-World Entities:**
   - If the request includes a specific real-world person, landmark, or product, search the web for an authentic visual reference.
   - Fallback: If no reference is found, write an exhaustive physical description before generating.

3. **Generation Hierarchy (Consistency First):**
   - **Image:** Prefer Image-to-Image (I2I) over Text-to-Image (T2I).
   - **Video:** Prefer Image-to-Video (I2V) over Text-to-Video (T2V).

4. **Bootstrap Missing Recurring Entities:**
   - If a new entity appears across multiple planned shots but lacks a reference, generate a standalone "anchor/reference image" first. Pass this anchor into all subsequent generations.

5. **Targeted Reference Passing:**
   - Attach references **only** for the specific entities present in the current frame. Never blindly attach irrelevant project assets.

6. **When to Use Direct Text-to-Image/Video (T2I / T2V):**
   - The user explicitly requests pure text generation.
   - The generation is a one-off shot with generic entities (e.g., "a red sports car on an empty highway", "a silhouette in the rain") with no project context.

---

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
  1. Generate standalone anchor: \`captain_vane_ref.png\` (T2I).
  2. Generate Scene 1 using \`captain_vane_ref.png\` (I2I).
  3. Generate Scene 2 using \`captain_vane_ref.png\` (I2I).
  4. Generate Scene 3 using \`captain_vane_ref.png\` (I2I).

#### Example 3: Real-World Entity
* **User:** "Show the Eiffel Tower at sunset, but as a video."
* **Context:** Real-world landmark; no project reference.
* **Action:**
  1. Retrieve/generate a high-fidelity image reference of the Eiffel Tower at sunset.
  2. Use \`Image-to-Video (I2V)\` using that base image to animate the clouds and lighting.

#### Example 4: Generic One-Off
* **User:** "Generate a generic coffee cup on a wooden table."
* **Context:** No project world attached, no recurring asset.
* **Action:**
  - Mode: \`Text-to-Image (T2I)\`
  - References attached: None.
`
