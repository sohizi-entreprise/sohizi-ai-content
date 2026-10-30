export default `
## Video Timeline Editing Skill

This guide defines the operational guardrails, rendering and spatial visibility mechanics, cross-track harmony rules, and professional editing techniques available in the video editor. Its purpose is to show what is possible with the editor's capabilities so you can choose the right techniques for the user's goal, genre, and creative brief rather than forcing a single rigid style.

---

### 1. Operational Guardrails & Tool Workflow

1. **Inspect Before Mutating:**
   - Always start by calling \`GET /video-editor/overview\` on the target composition file to inspect \`fps\`, \`width\`, \`height\`, \`aspectRatio\`, \`durationInFrames\`, and the ordered track list (\`position\`, \`type\`, \`trackId\`, \`muted\`, \`hidden\`).
   - Before adding, trimming, or shifting clips in a time range, inspect what is already active using \`GET /video-editor/frame\` (at a specific frame) or \`GET /video-editor/clips/list\` (filtered by \`fromFrame\`, \`toFrame\`, \`trackId\`, or \`type\`).
   - Always call \`GET /video-editor/clips/view\` before updating an existing clip so you know its exact \`startFrame\`, \`endFrame\`, \`sourceStartFrame\`, \`sourceDurationInFrames\`, and current \`properties\`.
   - Call \`GET /video-editor/clips/schema\` for the target \`clipType\` (\`video\`, \`audio\`, \`text\`, \`image\`, \`caption\`) whenever its property schema is not already in context.

2. **Prefer Atomic & Deterministic Endpoints (\`batch\`, \`clips/split\`, \`clips/ripple-shift\`):**
   - **Multi-Step Edits (\`POST /video-editor/batch\`):** Whenever an edit involves multiple tracks or clips (e.g., assembling a scene, updating a vertical group of voiceover + visual + text, or re-timing multiple shots), batch up to 50 operations (\`update_composition\`, \`add_track\`, \`update_track\`, \`remove_track\`, \`add_clip\`, \`update_clip\`, \`remove_clip\`) in a single \`POST /video-editor/batch\` call instead of issuing many sequential requests.
   - **Razor Splits (\`POST /video-editor/clips/split\`):** Use \`POST /video-editor/clips/split\` with \`{ clipId, frame }\` to split any clip into two contiguous clips at \`frame\`. It automatically calculates \`sourceStartFrame\` continuity (accounting for \`speed\`) and preserves fade boundaries cleanly.
   - **Downstream Ripple (\`POST /video-editor/clips/ripple-shift\`):** Use \`POST /video-editor/clips/ripple-shift\` with \`{ filePath, fromFrame, deltaFrames, trackId? }\` to shift all clips starting at or after \`fromFrame\` forward (\`+delta\`) or backward (\`-delta\`) without manual per-clip math.

3. **Frame Math & Time Conversion:**
   - All timeline positions are integer frames (\`0\`-indexed). Convert seconds to frames using the composition's \`fps\`:
     \`frames = Math.round(seconds * fps)\`
   - Every clip must satisfy \`startFrame >= 0\` and \`endFrame > startFrame\`.
   - Respect the 20-minute maximum timeline cap (\`1200 * fps\` frames).

4. **Source Media Bounds & Handle Integrity (\`video\` and \`audio\`):**
   - \`sourceStartFrame\` is the frame offset inside the source media file where playback begins when the timeline reaches \`startFrame\`.
   - \`sourceDurationInFrames\` is the total length of the underlying media asset in frames.
   - Never extend a \`video\` or \`audio\` clip past its available source media:
     \`sourceStartFrame + Math.ceil((endFrame - startFrame) * speed) <= sourceDurationInFrames\`
     Exceeding \`sourceDurationInFrames\` causes the video to freeze on its final frame or audio to drop out into dead silence.
   - **Left-Edge Trim Rule:** When trimming a clip's \`startFrame\` later by \`delta\` frames while keeping the rest of the clip anchored in timeline time, advance \`sourceStartFrame\` by \`Math.round(delta * speed)\` so the media stays in sync.

5. **Track-Type Strictness & Non-Overlapping Sibling Rule:**
   - Each track has a strict \`type\` (\`video\`, \`audio\`, \`text\`, \`image\`, or \`caption\`). Only place or move a clip onto a track of the exact same \`type\`.
   - **Never overlap two clips horizontally on the same track.** Clips on the same track must occupy disjoint frame intervals \`[startFrame, endFrame)\`. When two visual or audio elements must play simultaneously (such as a cross-dissolve, Picture-in-Picture, or voiceover over music), place them on separate tracks.
   - \`PATCH /video-editor/clips/update\` merges \`properties\` shallowly—only include the fields you intend to change.

---

### 2. Visual Hierarchy, Z-Order & Spatial Positioning (What Appears on Screen)

Understanding how tracks and clip coordinates map to the rendered canvas is critical so you never accidentally hide an element behind another layer.

#### A. Track \`position\` Determines Z-Order (Front-to-Back Visibility)
- Tracks are ordered by their integer \`position\` (\`0, 1, 2, ...\`).
- **\`position: 0\` is the top row of the timeline and the foreground layer closest to the camera.**
- The renderer paints tracks in reverse order from highest \`position\` (background) to \`position: 0\` (foreground):
  - **Smaller \`position\` (\`0, 1\`) = In Front (Foreground):** Titles, lower-thirds, animated captions, Picture-in-Picture (PiP) overlays, and B-roll cutaways.
  - **Larger \`position\` (\`2, 3, ...\`) = Behind (Background):** Primary A-roll video, full-canvas backdrops, and ambient background plates.
- **Full-Screen Occlusion:** Any \`video\` or \`image\` clip with \`widthRatio: 1\`, \`heightRatio: 1\`, and \`opacity: 1\` on a track with a smaller \`position\` (e.g., \`position: 0\`) will **completely cover and hide** any visual clips active at the same frames on tracks with larger \`position\` values (e.g., \`position: 1, 2\`).
- **Critical \`tracks/add\` Pitfall:** Calling \`POST /video-editor/tracks/add\` without specifying \`position\` appends the track at \`max(position) + 1\`, placing it at the **very back** of the visual stack.
  - When adding a foreground overlay track (\`text\`, \`caption\`, B-roll cutaway, or PiP \`image\`/\`video\`), explicitly pass \`position: 0\` (or update track positions via \`PATCH /video-editor/tracks/update\`) so the overlay renders in front of the main video track.
- **Track Visibility & Mute Flags:**
  - \`hidden: true\` on a track hides all of its visual clips from the canvas without deleting them.
  - \`muted: true\` silences all audio output from an \`audio\` or \`video\` track while leaving \`video\` visuals visible.
  - \`audio\` tracks have no visual presence; their \`position\` does not affect visual occlusion, and all unmuted \`audio\` and \`video\` tracks mix together simultaneously.

#### B. Canvas Coordinates, Aspect Fit & Legibility
- Every visual clip (\`video\`, \`image\`, \`text\`, \`caption\`) is positioned inside a bounding box anchored by its **center point**:
  - \`xRatio\` (\`0\` to \`1\`): Horizontal center (\`0\` = left edge, \`0.5\` = horizontal center, \`1\` = right edge).
  - \`yRatio\` (\`0\` to \`1\`): Vertical center (\`0\` = top edge, \`0.5\` = vertical center, \`0.85\` = standard lower-third/subtitle zone, \`1\` = bottom edge).
  - \`widthRatio\` & \`heightRatio\` (\`0.05\` to \`2\`): Bounding box size relative to the composition canvas (\`1\` = 100% of canvas width/height).
- **Object Fit (\`fit: "contain" | "cover"\` on \`video\` and \`image\`):**
  - Use \`fit: "cover"\` whenever a full-screen clip, split-screen panel, or rounded Picture-in-Picture box (\`borderRadius > 0\`) should completely fill its bounding box without letterboxing.
  - Use \`fit: "contain"\` (default) when the entire uncropped frame of an asset (such as a product shot, diagram, or UI screenshot) must remain visible.
- **Safe Margins & Text Readability:**
  - Keep \`text\` and \`caption\` clips within title-safe margins (\`xRatio\` between \`0.1\` and \`0.9\`, \`yRatio\` between \`0.12\` and \`0.88\`, \`widthRatio <= 0.85\`).
  - When placing \`text\` over video or imagery, guarantee legibility using one or more of:
    1. \`textShadow: true\` on the \`text\` clip for a clean drop shadow.
    2. \`backgroundColor\` (e.g., \`"#000000"\`) + \`backgroundOpacity\` (\`0.65\`–\`0.85\`) + \`borderRadius\` (\`12\`) on the \`text\` clip for a modern lower-third pill.
    3. Reducing \`brightness\` (\`55\`–\`80\`) or adding subtle \`blur\` (\`4\`–\`12\`) on the underlying \`video\` or \`image\` clip.

---

### 3. Composition Harmony & Cross-Track Synchronization

A timeline is an interconnected system. Editing one clip in isolation can break the timing of related overlays or knock downstream scenes out of sync. Whenever you modify a clip, maintain both **vertical** and **horizontal** harmony.

#### A. Vertical Harmony (Syncing Linked Elements Across Tracks)
Before changing a clip's \`startFrame\`, \`endFrame\`, or \`speed\`, call \`GET /video-editor/frame\` or \`GET /video-editor/clips/list\` over that clip's frame span to identify its **vertical group**—all clips on other tracks that belong to the same narrative beat (e.g., a voiceover \`audio\` clip + a supporting \`image\` or \`video\` clip + a \`text\` title or \`caption\` clip).

- **When Lengthening or Shortening Voiceover / Dialogue:**
  - If you make a voiceover clip longer by \`+delta\` frames (or replace it with a longer recording), also extend the \`endFrame\` of the accompanying \`image\`, \`video\`, or \`text\` clips that illustrate that spoken beat by \`+delta\` frames (use \`POST /video-editor/batch\` to update the whole vertical group together). Otherwise, the visual or title will vanish early and leave a black gap while the voice continues.
  - Conversely, if you trim a voiceover shorter by \`-delta\` frames, pull back the \`endFrame\` of its paired visual and \`text\` clips so visuals do not linger awkwardly after the speaker finishes.
- **Handling Video Source Limits When Extending:**
  - \`image\` and \`text\` clips can be extended to any \`endFrame\` freely.
  - If a paired \`video\` clip must cover a longer voiceover but lacks enough \`sourceDurationInFrames\` to extend directly:
    1. Slightly reduce its \`speed\` (e.g., \`0.85\`–\`0.95\`) if subtle slow motion fits the shot, **or**
    2. Keep the \`video\` clip within its source limit and bridge the remaining frames with a complementary B-roll \`image\`/\`video\` cutaway on a foreground track.

#### B. Horizontal Harmony (Rippling Downstream Clips)
- When you insert a new scene, delete a segment, or change the duration of an existing scene in the middle of the timeline by \`delta\` frames (\`+delta\` for expansion, \`-delta\` for contraction):
  - Call \`POST /video-editor/clips/ripple-shift\` with \`{ filePath, fromFrame: originalSceneEndFrame, deltaFrames: delta }\` (omitting \`trackId\` so all tracks shift together in lockstep).
  - If expanding (\`+delta\`), ripple-shift downstream clips **first** to open the gap before extending or inserting the new clip. If contracting (\`-delta\`), trim or remove the clip **first** and then ripple-shift downstream clips left by \`-delta\` to close the gap.

#### C. Composition & Audio Bed Closure
- After structural edits that change the total runtime of the sequence:
  - Trim or extend any continuous background music clip so it ends cleanly with the final visual cut (and apply \`fadeOutFrames: Math.round(1.5 * fps)\` on the final music segment so it fades out smoothly).
  - Update the composition's \`durationInFrames\` via \`PATCH /video-editor/composition\` (or inside \`POST /video-editor/batch\`) to match the final \`endFrame\` of the last active clip.

---

### 4. Professional Video Editing Techniques (What You Can Achieve)

Use the techniques below as a creative toolkit. Select the ones that best serve the pacing, tone, and user request—do not apply every effect to every video.

#### 1. Audio-First ("Radio Edit") Structure & Automated Captions
- In narrative, explainer, documentary, or talking-head edits, establish the audio spine first:
  - Lay out dialogue or voiceover clips in story order on an \`audio\` (or primary \`video\`) track.
  - Trim dead air at the heads and tails of clips, keeping natural breathing room (\`8\`–\`20\` frames / \`0.25\`–\`0.6s\`) between sentences and slightly longer pauses (\`24\`–\`40\` frames) after major revelations so statements land.
  - Once the spoken rhythm works on its own, align visual cuts, B-roll, and text callouts to the vocal beats.
  - **Word-by-Word Animated Captions:** When the user wants social-style subtitles or captions synced to speech, call \`POST /video-editor/captions/generate\` with the dialogue/voiceover \`trackId\` (and optional \`clipId\`). This automatically transcribes the audio and inserts a synchronized \`caption\` track directly above it, which you can then style via \`PATCH /video-editor/clips/update\` (\`fontSize\`, \`color\`, \`hightlightColor\`, \`backgroundColor\`, \`yRatio\`).

#### 2. J-Cuts & L-Cuts (Split Edits for Seamless Scene Flow)
When every audio cut and video cut happens on the exact same frame, the edit can feel mechanical or like a slideshow. Offsetting sound and picture by \`15\`–\`45\` frames (\`0.5\`–\`1.5s\`) creates organic flow:
- **J-Cut (Audio Leads Video):** The viewer hears the next scene or speaker \`15\`–\`30\` frames *before* the picture cuts to it, pulling attention forward.
  - *How to build:* Start the incoming voiceover/dialogue \`audio\` clip at \`cutFrame - 20\` (with \`fadeInFrames: 6\` for a clean audio entry), while the incoming \`video\`/\`image\` clip starts at \`cutFrame\`.
- **L-Cut (Video Leads Audio / Audio Trails):** The speaker's voice continues for \`15\`–\`45\` frames *after* the picture cuts to a new visual or reaction shot.
  - *How to build:* While a talking-head \`video\` clip plays on \`position: 2\`, place a muted (\`volume: 0\`) B-roll \`video\` or \`image\` clip on a foreground track (\`position: 1\`) starting \`30\` frames before the speaker finishes talking. The audience sees the visual evidence while hearing the speaker conclude their point.

#### 3. Smooth Transitions, Fades & Motion Polish (\`fadeInFrames\`, \`fadeOutFrames\`, \`animationIn\`, \`animationOut\`, \`motionEffect\`)
- **Hard Cuts by Default:** Use clean hard cuts as your default transition between shots within the same scene.
- **Cross-Dissolves (Two-Track Overlap with Fades):** When transitioning across time/location or blending atmospheric shots:
  - Place Shot A on \`position: 2\` ending at \`cutFrame + 15\` with \`fadeOutFrames: 15\`.
  - Place Shot B on \`position: 1\` starting at \`cutFrame\` with \`fadeInFrames: 15\`.
- **Fade from/to Black:** Set \`fadeInFrames: 15\`–\`30\` on the opening visual clip of a composition and \`fadeOutFrames: 20\`–\`45\` on the final visual and audio clips.
- **Kinetic Entrance/Exit Presets (\`animationIn\` / \`animationOut\`):**
  - On \`text\` titles, lower-thirds, and PiP callouts, set \`animationIn: "slide-up" | "scale-up" | "fade"\` and \`animationOut: "fade" | "slide-down" | "scale-down"\` so graphics animate onto and off the canvas rather than popping abruptly.
  - Keep a consistent animation language across all titles in the same video.
- **Ken Burns & Camera Motion on Static Images (\`motionEffect\`):**
  - Static images in a video timeline can feel lifeless if held completely still. When placing \`image\` clips (such as storyboard panels, archival photos, or AI-generated scenes), apply \`motionEffect: "ken-burns-in"\`, \`"ken-burns-out"\`, \`"pan-left"\`, or \`"pan-right"\` (often paired with \`fit: "cover"\`) to give the sequence continuous cinematic camera movement. Alternate directions gently between consecutive shots.

#### 4. B-Roll Cutaways, Inserts & Jump-Cut Masking
- **Illustrating Spoken Points (Cutaways):** Place B-roll \`video\` (with \`volume: 0\`) or \`image\` clips on a track with a smaller \`position\` than the main A-roll track so it temporarily covers the speaker without interrupting their audio.
- **Punch-In / Reframe to Hide Jump Cuts:** When you remove a mistake or pause from the middle of a continuous talking-head shot (using \`POST /video-editor/clips/split\` + trimming + \`POST /video-editor/clips/ripple-shift\`), placing the two halves back-to-back creates a jump cut. Mask it by either:
  - Placing a B-roll cutaway on an upper track across the cut point, **or**
  - Applying a **digital punch-in** on the second clip via \`PATCH /video-editor/clips/update\`: increase \`widthRatio\` and \`heightRatio\` from \`1\` to \`1.15\`–\`1.25\` (and subtly adjust \`yRatio\`, e.g., \`0.52\`) so the framing tightens like a second camera angle.

#### 5. Dynamic Audio Ducking & Layered Sound Design
A background music track at full volume will overpower dialogue. To achieve a balanced broadcast mix:
- **Voice Priority:** Keep primary dialogue/voiceover clips at \`volume: 0.85\`–\`1.0\`.
- **Ducking Music Under Speech:** Use \`POST /video-editor/clips/split\` on the background music clip at the frames where voiceover sections begin and end:
  - Set music \`volume: 0.60\`–\`0.85\` during intro, outro, and pure visual montage sections (with \`fadeInFrames\` on the intro and \`fadeOutFrames\` on the outro).
  - Set music \`volume: 0.12\`–\`0.20\` during segments where voiceover or dialogue is active.

#### 6. Pacing, Rhythm & Speed Ramping
- **Vary Shot Lengths with Purpose:** Avoid robotic, identical clip durations across an entire timeline. Hold emotionally weighty or information-dense shots longer (\`3\`–\`6s\`), and accelerate through kinetic action or montage beats (\`0.8\`–\`2s\`).
- **Cut on Action / Visual Match:** When trimming \`video\` clips, choose \`sourceStartFrame\` and \`endFrame\` so cuts happen mid-movement (e.g., a gesture, turn, or camera pan) rather than on static pauses; motion carries the viewer's eye across the edit.
- **Speed Ramping:** To create a fast-to-slow impact (or slow-to-fast time-lapse transition) within a single video shot, use \`POST /video-editor/clips/split\` to divide the \`video\` clip into 2–3 contiguous segments and update their \`speed\` properties (e.g., Segment 1 at \`speed: 1.5\` -> Segment 2 at \`speed: 0.5\`), adjusting subsequent \`sourceStartFrame\` values if you change an earlier segment's \`speed\`:
  \`nextSourceStartFrame = prevSourceStartFrame + Math.round((prevEndFrame - prevStartFrame) * prevSpeed)\`.

#### 7. Multi-Layer Canvas Layouts & Visual Polish
- **Picture-in-Picture (PiP) & Reaction Overlays:**
  - Keep the main content full-frame (\`widthRatio: 1, heightRatio: 1, fit: "cover"\`) on a background track (\`position: 2\`).
  - Place the presenter or secondary visual on a foreground track (\`position: 1\`) scaled down and anchored to a corner, e.g., \`widthRatio: 0.28, heightRatio: 0.28, xRatio: 0.82, yRatio: 0.22, borderRadius: 16, fit: "cover", animationIn: "scale-up"\`.
- **Split-Screen Comparisons:**
  - Place two visual clips active over the same frame range on \`position: 1\` and \`position: 2\`, positioned left and right:
    - Left clip: \`xRatio: 0.25, yRatio: 0.5, widthRatio: 0.48, heightRatio: 0.85, borderRadius: 12, fit: "cover"\`
    - Right clip: \`xRatio: 0.75, yRatio: 0.5, widthRatio: 0.48, heightRatio: 0.85, borderRadius: 12, fit: "cover"\`
- **Stylized Blurred Backdrops (Aspect Ratio & Depth Polish):**
  - When showcasing a vertical or square asset inside a wide composition (or creating a moody title card over video/image), place a copy of the media on a background track (\`position: 2\`) with \`widthRatio: 1.2, heightRatio: 1.2, fit: "cover", blur: 20, brightness: 55\`, and place the sharp foreground subject (\`blur: 0, brightness: 100, fit: "contain"\`) or \`text\` clip on a foreground track (\`position: 1\` or \`0\`).
`.trim()
