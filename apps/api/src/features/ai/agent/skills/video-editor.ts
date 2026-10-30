export default `
## Video Timeline Editing Skill

This guide defines the operational guardrails, rendering and spatial visibility mechanics, cross-track harmony rules, and professional editing techniques available in the video editor. Its purpose is to show what is possible with the editor's capabilities so you can choose the right techniques for the user's goal, genre, and creative brief rather than forcing a single rigid style.

---

### 1. Operational Guardrails & Tool Workflow

1. **Inspect Before Mutating:**
   - Always start by calling \`GET /video-editor/overview\` on the target composition file to inspect \`fps\`, \`width\`, \`height\`, \`aspectRatio\`, \`durationInFrames\`, and the ordered track list (\`position\`, \`type\`, \`trackId\`, \`muted\`, \`hidden\`).
   - Before adding, trimming, or shifting clips in a time range, inspect what is already active using \`GET /video-editor/frame\` (at a specific frame) or \`GET /video-editor/clips/list\` (filtered by \`fromFrame\`, \`toFrame\`, \`trackId\`, or \`type\`).
   - Always call \`GET /video-editor/clips/view\` before updating an existing clip so you know its exact \`startFrame\`, \`endFrame\`, \`sourceStartFrame\`, \`sourceDurationInFrames\`, and current \`properties\`.
   - Call \`GET /video-editor/clips/schema\` for the target \`clipType\` (\`video\`, \`audio\`, \`text\`, \`image\`) whenever its property schema is not already in context.

2. **Frame Math & Time Conversion:**
   - All timeline positions are integer frames (\`0\`-indexed). Convert seconds to frames using the composition's \`fps\`:
     \`frames = Math.round(seconds * fps)\`
   - Every clip must satisfy \`startFrame >= 0\` and \`endFrame > startFrame\`.
   - Respect the 20-minute maximum timeline cap (\`1200 * fps\` frames).

3. **Source Media Bounds & Handle Integrity (\`video\` and \`audio\`):**
   - \`sourceStartFrame\` is the frame offset inside the source media file where playback begins when the timeline reaches \`startFrame\`.
   - \`sourceDurationInFrames\` is the total length of the underlying media asset in frames.
   - Never extend a \`video\` or \`audio\` clip past its available source media:
     \`sourceStartFrame + Math.ceil((endFrame - startFrame) * speed) <= sourceDurationInFrames\`
     Exceeding \`sourceDurationInFrames\` causes the video to freeze on its final frame or audio to drop out into dead silence.
   - **Left-Edge Trim Rule:** When trimming a clip's \`startFrame\` later by \`delta\` frames while keeping the rest of the clip anchored in timeline time, advance \`sourceStartFrame\` by \`Math.round(delta * speed)\` so the media stays in sync.

4. **Track-Type Strictness & Partial Property Updates:**
   - Each track has a strict \`type\` (\`video\`, \`audio\`, \`text\`, or \`image\`). Only place or move a clip onto a track of the exact same \`type\`.
   - Avoid overlapping two clips in the same frame range on the same track. Use separate tracks when layering visual or audio elements simultaneously.
   - \`PATCH /video-editor/clips/update\` merges \`properties\` shallowly—only include the fields you intend to change.

---

### 2. Visual Hierarchy, Z-Order & Spatial Positioning (What Appears on Screen)

Understanding how tracks and clip coordinates map to the rendered canvas is critical so you never accidentally hide an element behind another layer.

#### A. Track \`position\` Determines Z-Order (Front-to-Back Visibility)
- Tracks are ordered by their integer \`position\` (\`0, 1, 2, ...\`).
- **\`position: 0\` is the top row of the timeline and the foreground layer closest to the camera.**
- The renderer paints tracks in reverse order from highest \`position\` (background) to \`position: 0\` (foreground):
  - **Smaller \`position\` (\`0, 1\`) = In Front (Foreground):** Titles, lower-thirds, captions, Picture-in-Picture (PiP) overlays, and B-roll cutaways.
  - **Larger \`position\` (\`2, 3, ...\`) = Behind (Background):** Primary A-roll video, full-canvas backdrops, and ambient background plates.
- **Full-Screen Occlusion:** Any \`video\` or \`image\` clip with \`widthRatio: 1\`, \`heightRatio: 1\`, and \`opacity: 1\` on a track with a smaller \`position\` (e.g., \`position: 0\`) will **completely cover and hide** any visual clips active at the same frames on tracks with larger \`position\` values (e.g., \`position: 1, 2\`).
- **Critical \`tracks/add\` Pitfall:** Calling \`POST /video-editor/tracks/add\` without specifying \`position\` appends the track at \`max(position) + 1\`, placing it at the **very back** of the visual stack.
  - When adding a foreground overlay track (\`text\`, B-roll cutaway, or PiP \`image\`/\`video\`), explicitly pass \`position: 0\` (or update track positions via \`PATCH /video-editor/tracks/update\`) so the overlay renders in front of the main video track.
- **Track Visibility & Mute Flags:**
  - \`hidden: true\` on a track hides all of its visual clips from the canvas without deleting them.
  - \`muted: true\` silences all audio output from an \`audio\` or \`video\` track while leaving \`video\` visuals visible.
  - \`audio\` tracks have no visual presence; their \`position\` does not affect visual occlusion, and all unmuted \`audio\` and \`video\` tracks mix together simultaneously.

#### B. Canvas Coordinates & Framing (\`xRatio\`, \`yRatio\`, \`widthRatio\`, \`heightRatio\`)
- Every visual clip (\`video\`, \`image\`, \`text\`) is positioned inside a bounding box anchored by its **center point**:
  - \`xRatio\` (\`0\` to \`1\`): Horizontal center (\`0\` = left edge, \`0.5\` = horizontal center, \`1\` = right edge).
  - \`yRatio\` (\`0\` to \`1\`): Vertical center (\`0\` = top edge, \`0.5\` = vertical center, \`0.85\` = standard lower-third/subtitle zone, \`1\` = bottom edge).
  - \`widthRatio\` & \`heightRatio\` (\`0.05\` to \`2\`): Bounding box size relative to the composition canvas (\`1\` = 100% of canvas width/height; values \`> 1\` zoom/crop past the canvas edges). Media inside the box renders with \`objectFit: "contain"\`.
- **Safe Margins & Legibility:**
  - Keep \`text\` clips within title-safe margins (\`xRatio\` between \`0.1\` and \`0.9\`, \`yRatio\` between \`0.12\` and \`0.88\`, \`widthRatio <= 0.85\`) so text never clips against the canvas edge.
  - Ensure contrast between foreground \`text\` and the visual layer behind it: adjust \`color\`, or soften a busy background \`image\` clip by reducing its \`brightness\` (e.g., \`60\`–\`80\`) or increasing its \`blur\` (e.g., \`4\`–\`12\`).

---

### 3. Composition Harmony & Cross-Track Synchronization

A timeline is an interconnected system. Editing one clip in isolation can break the timing of related overlays or knock downstream scenes out of sync. Whenever you modify a clip, maintain both **vertical** and **horizontal** harmony.

#### A. Vertical Harmony (Syncing Linked Elements Across Tracks)
Before changing a clip's \`startFrame\`, \`endFrame\`, or \`speed\`, call \`GET /video-editor/frame\` or \`GET /video-editor/clips/list\` over that clip's frame span to identify its **vertical group**—all clips on other tracks that belong to the same narrative beat (e.g., a voiceover \`audio\` clip + a supporting \`image\` or \`video\` clip + a \`text\` title or lower-third).

- **When Lengthening or Shortening Voiceover / Dialogue:**
  - If you make a voiceover clip longer by \`+delta\` frames (or replace it with a longer recording), also extend the \`endFrame\` of the accompanying \`image\`, \`video\`, or \`text\` clips that illustrate that spoken beat by \`+delta\` frames. Otherwise, the visual or title will vanish early and leave a black gap while the voice continues.
  - Conversely, if you trim a voiceover shorter by \`-delta\` frames, pull back the \`endFrame\` of its paired visual and \`text\` clips so visuals do not linger awkwardly after the speaker finishes.
- **Handling Video Source Limits When Extending:**
  - \`image\` and \`text\` clips can be extended to any \`endFrame\` freely.
  - If a paired \`video\` clip must cover a longer voiceover but lacks enough \`sourceDurationInFrames\` to extend directly:
    1. Slightly reduce its \`speed\` (e.g., \`0.85\`–\`0.95\`) if subtle slow motion fits the shot, **or**
    2. Keep the \`video\` clip within its source limit and bridge the remaining frames with a complementary B-roll \`image\`/\`video\` cutaway on a foreground track.

#### B. Horizontal Harmony (Rippling Downstream Clips)
- When you insert a new scene, delete a segment, or change the duration of an existing scene in the middle of the timeline by \`delta\` frames (\`+delta\` for expansion, \`-delta\` for contraction):
  - Query all downstream clips across **all** tracks where \`startFrame >= originalSceneEndFrame\`.
  - Shift both \`startFrame\` and \`endFrame\` of every downstream clip by \`delta\` frames so subsequent voiceovers, visuals, and text remain locked together without accidental collisions or black gaps.
- **Check Adjacent Overlaps:** When shifting a clip on a track, verify that its new \`[startFrame, endFrame)\` does not collide with the previous or next clip on that same track.

#### C. Composition & Audio Bed Closure
- After structural edits that change the total runtime of the sequence:
  - Trim or extend any continuous background music clip so it ends cleanly with the final visual cut.
  - Update the composition's \`durationInFrames\` via \`PATCH /video-editor/composition\` to match the final \`endFrame\` of the last active clip (avoiding trailing black frames or prematurely cutting off the ending).

---

### 4. Professional Video Editing Techniques (What You Can Achieve)

Use the techniques below as a creative toolkit. Select the ones that best serve the pacing, tone, and user request—do not apply every effect to every video.

#### 1. Audio-First ("Radio Edit") Structure
- In narrative, explainer, documentary, or talking-head edits, establish the audio spine first:
  - Lay out dialogue or voiceover clips in story order on an \`audio\` (or primary \`video\`) track.
  - Trim dead air at the heads and tails of clips, keeping natural breathing room (\`8\`–\`20\` frames / \`0.25\`–\`0.6s\`) between sentences and slightly longer pauses (\`24\`–\`40\` frames) after major revelations so statements land.
  - Once the spoken rhythm works on its own, align visual cuts, B-roll, and text callouts to the vocal beats.

#### 2. Precision Razor Split (Compound Operation)
The editor does not have a single "split" endpoint; you achieve a frame-accurate razor split at frame \`F\` (\`startFrame < F < endFrame\`) in two steps:
1. **Trim Original Clip (Left Half):** \`PATCH /video-editor/clips/update\` on the existing clip with \`endFrame: F\`.
2. **Add New Clip (Right Half):** \`POST /video-editor/clips/add\` on the same \`trackId\` with:
   - \`startFrame: F\`
   - \`endFrame: originalEndFrame\`
   - \`sourceStartFrame: originalSourceStartFrame + Math.round((F - originalStartFrame) * speed)\` (for \`video\`/\`audio\`; \`0\` for \`text\`/\`image\`)
   - \`sourceDurationInFrames: originalSourceDurationInFrames\`
   - \`properties\`: copy the original clip's properties (and modify the right half as needed).

#### 3. J-Cuts & L-Cuts (Split Edits for Seamless Transitions)
When every audio cut and video cut happens on the exact same frame, the edit can feel mechanical or like a slideshow. Offsetting sound and picture by \`15\`–\`45\` frames (\`0.5\`–\`1.5s\`) creates organic flow:
- **J-Cut (Audio Leads Video):** The viewer hears the next scene or speaker \`15\`–\`30\` frames *before* the picture cuts to it, pulling attention forward.
  - *How to build:* Start the incoming voiceover/dialogue \`audio\` clip at \`cutFrame - 20\`, while the incoming \`video\`/\`image\` clip starts at \`cutFrame\`. (If the incoming clip is a \`video\` with embedded speech, place an \`audio\` clip or overlapping \`video\` track for the lead-in, or let the outgoing B-roll on a higher-priority track cover the first \`20\` frames of the incoming shot.)
- **L-Cut (Video Leads Audio / Audio Trails):** The speaker's voice continues for \`15\`–\`45\` frames *after* the picture cuts to a new visual or reaction shot.
  - *How to build:* While a talking-head \`video\` clip plays on \`position: 2\`, place a muted (\`volume: 0\`) B-roll \`video\` or \`image\` clip on a foreground track (\`position: 1\`) starting \`30\` frames before the speaker finishes talking. The audience sees the visual evidence while hearing the speaker conclude their point.

#### 4. B-Roll Cutaways, Inserts & Jump-Cut Masking
- **Illustrating Spoken Points (Cutaways):** Place B-roll \`video\` (with \`volume: 0\`) or \`image\` clips on a track with a smaller \`position\` than the main A-roll track so it temporarily covers the speaker without interrupting their audio.
- **Punch-In / Reframe to Hide Jump Cuts:** When you remove a mistake or pause from the middle of a continuous talking-head shot, placing the two halves back-to-back creates a jarring jump cut. You can make the cut look like an intentional two-camera switch by either:
  - Placing a B-roll cutaway on an upper track across the cut point, **or**
  - Applying a **digital punch-in** on the second clip via \`PATCH /video-editor/clips/update\`: increase \`widthRatio\` and \`heightRatio\` from \`1\` to \`1.15\`–\`1.25\` (and subtly adjust \`yRatio\`, e.g., \`0.52\`) so the framing tightens on the speaker.

#### 5. Dynamic Audio Ducking & Layered Sound Design
Because \`volume\` is a per-clip property (\`0\` to \`1\`), a single music clip at full volume will overpower dialogue. To achieve professional audio mixing:
- **Voice Priority:** Keep primary dialogue/voiceover clips at \`volume: 0.85\`–\`1.0\`.
- **Envelope Ducking via Razor Splits:** Split the background music clip at the frames where speech starts and ends:
  - Set music \`volume: 0.60\`–\`0.85\` during intro, outro, and pure visual montage sections.
  - Set music \`volume: 0.10\`–\`0.20\` during segments where voiceover or dialogue is active.
  - *Smooth Fade Step (Optional):* Insert a short \`10\`–\`15\` frame transitional segment of the music clip at \`volume: 0.35\` between the loud and ducked sections so the volume change feels gradual rather than abrupt.

#### 6. Pacing, Rhythm & Speed Ramping
- **Vary Shot Lengths with Purpose:** Avoid robotic, identical clip durations across an entire timeline. Hold emotionally weighty or information-dense shots longer (\`3\`–\`6s\`), and accelerate through kinetic action or montage beats (\`0.8\`–\`2s\`).
- **Cut on Action / Visual Match:** When trimming \`video\` clips, choose \`sourceStartFrame\` and \`endFrame\` so cuts happen mid-movement (e.g., a gesture, turn, or camera pan) rather than on static pauses; motion carries the viewer's eye across the edit.
- **Speed Ramping:** To create a fast-to-slow impact (or slow-to-fast time-lapse transition) within a single video shot, split the \`video\` clip into 2–3 contiguous segments on the same track and step the \`speed\` property (e.g., Segment 1 at \`speed: 1.5\` -> Segment 2 at \`speed: 0.5\`), computing each segment's \`sourceStartFrame\` from the frames consumed by the prior segment:
  \`nextSourceStartFrame = prevSourceStartFrame + Math.round((prevEndFrame - prevStartFrame) * prevSpeed)\`.

#### 7. Multi-Layer Canvas Layouts & Visual Polish
- **Picture-in-Picture (PiP) & Reaction Overlays:**
  - Keep the main content full-frame (\`widthRatio: 1, heightRatio: 1\`) on a background track (\`position: 2\`).
  - Place the presenter or secondary visual on a foreground track (\`position: 1\`) scaled down and anchored to a corner, e.g., \`widthRatio: 0.28, heightRatio: 0.28, xRatio: 0.82, yRatio: 0.22, borderRadius: 16\`.
- **Split-Screen Comparisons:**
  - Place two visual clips active over the same frame range on \`position: 1\` and \`position: 2\`, positioned left and right:
    - Left clip: \`xRatio: 0.25, yRatio: 0.5, widthRatio: 0.48, heightRatio: 0.85, borderRadius: 12\`
    - Right clip: \`xRatio: 0.75, yRatio: 0.5, widthRatio: 0.48, heightRatio: 0.85, borderRadius: 12\`
- **Stylized Blurred Backdrops (Aspect Ratio & Depth Polish):**
  - When showcasing an image or portrait asset inside a wide composition (or creating a moody title card), place a copy of the image on a background track (\`position: 2\`) with \`widthRatio: 1.25, heightRatio: 1.25, blur: 24, brightness: 55\`, and place the sharp subject image (\`blur: 0, brightness: 100\`) or \`text\` clip on a foreground track (\`position: 1\` or \`0\`).
- **Restrained Transitions (Hard Cuts vs. Stepped Fades):**
  - Use clean hard cuts as your default; overusing transitions makes an edit feel amateurish.
  - When a scene change genuinely signals the passage of time or a final fade-out, you can create a stepped cross-dissolve or fade-to-black by overlapping the outgoing and incoming clips across two tracks for \`9\`–\`15\` frames and stepping the foreground clip's \`opacity\` (e.g., three \`4\`-frame micro-segments at \`opacity: 0.25\`, \`0.55\`, \`0.85\`) or stepping an \`image\` clip's \`brightness\` down toward \`0\`.
`.trim()
