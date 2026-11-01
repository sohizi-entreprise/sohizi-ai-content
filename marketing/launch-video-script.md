# Sohizi Lab — 52-Second Launch Video Script & Motion Graphics Specification

**Target Duration:** `00:52.00` (52 seconds | `3,120 frames` @ `60fps` or `1,560 frames` @ `30fps`)  
**Primary Audience:** Solo AI filmmakers, narrative creators, and brand video producers who make multi-shot videos  
**Core Positioning:** The project-aware AI video production workspace  
**Story Followed On Screen:** _"The Last Signal"_ — a sci-fi thriller short featuring protagonist **Mara** (yellow rain jacket, portable radio receiver, rain-slicked rooftop at night) developed from script to final MP4 cut inside one Sohizi Lab project.  
**Primary CTA:** `Create your first project` (`Your files, scenes, and creative direction stay in one project.`)

---

## 1. Strategic Grounding: Why This Script Works

### A. Real Creator Language (Sourced from Reddit `r/aifilmmaking`, `r/StableDiffusion`, `r/aitubers`)

AI video creators immediately tune out generic claims like _"revolutionary all-in-one AI studio"_ or _"idea to video in seconds."_ When creators describe their actual frustration on Reddit and forums, they talk about **production amnesia, tab chaos, and reference drift**:

| Creator Pain Point                      | Exact Community Language (Reddit VOC)                                                                                                                                                           | How the Script Uses It                                                                                                                                                                          |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Character & Scene Drift**             | _"Same words, different face, every generation."_ / _"Every new generation forgets the decisions the film has already made."_                                                                   | **Scene 01 Hook (0:00–0:04):** Opens immediately on the exact same prompt producing 3 different faces across 3 shots.                                                                           |
| **Tab & Spreadsheet Juggling**          | _"15 tabs open with reference frames, preview windows, and prompt docs."_ / _"The people making consistent multi-minute stuff aren't using a magic tool, they're running a spreadsheet."_       | **Scene 02 Problem (0:04–0:11):** Visually shows the 15-tab browser bar, a shot-list spreadsheet (`locked_prompt`, `seed`, `mara_take_v4_FINAL.mp4`), and a re-upload spinner.                  |
| **Burning Credits Before Locking Refs** | _"Lock every still asset (characters, locations, coverage frames) before you spend a dollar on video. Nearly all the waste comes from paying for clips off references that weren't right yet."_ | **Scene 05 Storyboard & World Bible (0:23–0:30):** Demonstrates locking canonical character sheets (`mara-ref.png`), lighting, and 3-column storyboard frames before generating video.          |
| **The Export/Re-upload Commute**        | _"The tool that finally makes the sequence work is still the editor, and the editor has no record of the story."_                                                                               | **Scene 06–07 Generation to Timeline (0:30–0:44):** Shows takes and audio landing directly in `/root/assets` and snapping onto the timeline in the same workspace—zero downloads or re-uploads. |

### B. Motion Benchmark Inspiration

- **Descript "Underlord" Launch Film:** Uses a strict visual feedback loop with aggressive scale punch-ins connecting text input (`@script.md`, `@mara-ref.png`) directly to UI output (storyboard shot cards and timeline tracks).
- **Linear Release Films:** Dark, atmospheric palette matching the product (`#0d0e14` background, `#d6f01a` luminous lemon-green accent). No stock footage, no talking heads, and only **three disciplined motion behaviors** repeated throughout.
- **Framer "Skills" Launch Film:** Punches tightly into the real input box (`Use @ to reference files and / for commands`) so viewers learn the exact product mechanism visually.
- **Muted-Feed Survival:** Every beat pairs conversational voiceover (124 words total) with bold, standalone kinetic headlines (4–8 words per card) so the film converts at 100% comprehension with sound off.

---

## 2. Global Production Specs for the Coding Agent

A coding agent (e.g., Remotion / React / Canvas / Motion Canvas) should use these exact constants to render the video deterministically.

### A. Canvas & Frame Configuration

```typescript
export const VIDEO_CONFIG = {
  fps: 60, // Divide all frame numbers by 2 if rendering at 30fps
  durationInSeconds: 52,
  durationInFrames: 3120,
  width: 1920,
  height: 1080,
  // Safe zone for 9:16 vertical crop (center 608x1080 or 1080x1920 re-layout)
  safeZoneX: [360, 1560],
  safeZoneY: [90, 990],
} as const
```

### B. Exact Sohizi Lab Design System Tokens

Pulled directly from `packages/ui/src/styles.css` and `apps/web/src/styles.css`:

```typescript
export const SOHIZI_TOKENS = {
  colors: {
    background: "oklch(0.18 0.01 265)", // Hex fallback: #0d0e14 (Main editor background)
    foreground: "oklch(0.8717 0.0093 258.34)", // Hex fallback: #d8dae0 (Crisp white body text)
    card: "oklch(0.2276 0.0098 276.63)", // Hex fallback: #181a24 (Elevated panels)
    popover: "oklch(0.2779 0.0093 276.78)", // Hex fallback: #242633 (Dropdowns / docks)
    surface: "oklch(0.2819 0.0092 276.79)", // Hex fallback: #252836 (Active editor tab surface)
    sidebar: "oklch(0.23 0.015 265)", // Hex fallback: #191b26 (File explorer column)
    primary: "oklch(0.936 0.225 121.24)", // Hex fallback: #d6f01a / rgb(212, 255, 0) (Luminous Lemon Green)
    primaryForeground: "oklch(0.18 0.01 265)", // Deep slate text on primary CTA buttons
    secondary: "oklch(0.28 0.02 265)", // Hex fallback: #242838 (Hover / active row)
    muted: "oklch(0.23 0.015 265)", // Hex fallback: #191c26
    mutedForeground: "oklch(0.55 0.015 265)", // Hex fallback: #6e7385 (Placeholders, secondary labels)
    destructive: "oklch(0.7 0.16 25)", // Hex fallback: #e05a47 (Error / drift indicator)
    border: "rgba(255, 255, 255, 0.10)", // 1px structural borders
    fileTagBg: "rgba(214, 240, 26, 0.10)", // .file-tag-link background
    fileTagText: "#d6f01a", // .file-tag-link text
    // Semantic File Tree Icon Colors
    iconDocBlue: "oklch(0.75 0.13 250)", // #66a3ff (Markdown / Script docs)
    iconMediaGreen: "oklch(0.77 0.22 148)", // #3ce67a (Image / Video / Audio assets)
    iconStoryboardPink: "#f472b6", // Storyboard & Video Editor files
    iconContextYellow: "oklch(0.78 0.17 65)", // #f59e0b (Context & Skill files)
  },
  fonts: {
    display: '"Space Grotesk", -apple-system, sans-serif', // Weight 600, tracking -0.03em
    sans: '"Geist", -apple-system, sans-serif', // Weight 400/500, UI labels & chat
    mono: '"JetBrains Mono", monospace', // Weight 400/500, timecodes, paths, seeds
    screenplay: '"Courier Prime", monospace', // 12pt screenplay body inside script editor
  },
  radii: {
    panel: "16px", // rounded-2xl on main workspace cards
    inner: "8px", // --radius: 0.5rem on buttons, shot cards, inputs
    pill: "9999px", // .file-tag-link and floating toolbar pills
  },
  shadows: {
    primaryGlow: "0 4px 24px rgba(214, 240, 26, 0.18)",
    aiPulse: "0 0 15px rgba(66, 240, 66, 0.15)",
    deepWindow: "0 24px 64px rgba(0, 0, 0, 0.65)",
  },
} as const
```

### C. Three Allowed Motion Primitives (Linear / Descript House Style)

Do **not** use random bounce effects, 3D flips, or star wipes. Restrict all animations to these three primitives:

1. **`PUNCH_IN` (Camera Scale & Focus Shift):**
   - Spring config: `{ stiffness: 220, damping: 26, mass: 0.9 }`
   - Used to snap from the full `1920x1080` workspace shell (`scale: 1.0`) into an active UI region (`scale: 1.85` to `2.4`) when the user types a prompt or clicks a control.
2. **`PANEL_GLIDE` (Horizontal / Vertical Context Pan):**
   - Spring config: `{ stiffness: 140, damping: 24, mass: 1.0 }`
   - Used to follow an asset moving from left (`FILES` explorer) -> center (`Storyboard` or `Stage`) -> right (`Koli` chat) -> bottom (`Timeline`).
3. **`HARD_STATE_CUT` (0-Frame Instant Swap + 6-Frame Border Flash):**
   - When an action completes (e.g., accepting a markdown diff or approving a generated take), cut on the exact frame with a subtle `1px solid #d6f01a` border pulse (`opacity: 1 -> 0` over 12 frames).

---

## 3. Master Script Read-Through & Timing Budget

**Total Spoken Words:** 124 words (comfortable, deliberate 140 WPM studio read with breathing room for UI sound design).

| Scene            | Timecode    | Frames (60fps) | On-Screen Kinetic Headline (Muted-Safe)                                                  | Voiceover (Spoken Audio)                                                                                                           | Sound Design / SFX                                                          |
| :--------------- | :---------- | :------------- | :--------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------- |
| **01. Hook**     | `0:00–0:04` | `0–240`        | **Same prompt. Different face. Every shot.**                                             | You type the exact same prompt. And get a different face in every shot.                                                            | 3 rapid mechanical shutter clicks -> low bass drop on frame 120.            |
| **02. Problem**  | `0:04–0:11` | `240–660`      | **15 tabs. A spreadsheet. Zero memory.**                                                 | Making one AI clip is easy. Making eighteen shots hold together takes fifteen browser tabs, a spreadsheet, and endless re-uploads. | Cluttered UI notification ticks, keyboard clatter, rising tension hum.      |
| **03. Reveal**   | `0:11–0:17` | `660–1020`     | **Sohizi Lab** — _One project that remembers the film you're making._                    | Sohizi Lab puts your entire production inside one project that actually remembers the film you're making.                          | Clean magnetic snap (`660f`), warm sub-bass swell, crisp UI settle.         |
| **04. Write**    | `0:17–0:23` | `1020–1380`    | **1. Write with an assistant that read the project.**                                    | Start in the script. Ask Koli to break Scene One into shots—using the character sheet and brief already in your files.             | Tactile keystrokes, soft chime on `@script.md` and `@mara-ref.png` pills.   |
| **05. Plan**     | `0:23–0:30` | `1380–1800`    | **2. Lock your world and storyboard before spending credits.**                           | Lock your world palette, lighting, and storyboard frames first—so you stop burning video credits on guesses.                       | Card cascade ticks (`3x`), drawer slide whoosh, lock click on `World` pill. |
| **06. Generate** | `0:30–0:37` | `1800–2220`    | **3. Generate video, voice, and sound in context.**                                      | Generate video takes, dialogue, and rain ambience right from the approved shot. Every take stays attached to the scene.            | Digital matrix hum, 4-take reveal pop, rain + radio static audio preview.   |
| **07. Edit**     | `0:37–0:44` | `2220–2640`    | **4. Cut the timeline without downloading a single file.**                               | Open the video editor and your approved clips, voice, and captions are already there. Drop them on the timeline and cut.           | Magnetic timeline clip snaps (`3x`), playhead scrub, dialogue line plays.   |
| **08. Payoff**   | `0:44–0:48` | `2640–2880`    | **One story. Start to final cut.**                                                       | From first line to final export, the production never leaves the room.                                                             | Cinematic synth pulse + Mara's line: _"Signal locked. Sector four."_        |
| **09. End Card** | `0:48–0:52` | `2880–3120`    | **Start the video in the project you will finish it in.**<br>`Create your first project` | Start the video in the project you'll finish it in. Create your first project on Sohizi Lab.                                       | Resonant resolving chord, subtle cursor click on CTA button.                |

---

## 4. Scene-by-Scene Motion Graphic Specification

Below is the frame-accurate blueprint for each scene. Every UI label, layout proportion, and color matches the real Sohizi Lab codebase.

---

### SCENE 01: The 3-Second Hook (Character Drift)

- **Timecode:** `0:00.00 – 0:04.00` (`Frames 0 – 240` @ 60fps)
- **Narrative Goal:** Stop the scroll in the first 1.5 seconds by visualizing the #1 frustration on `r/aifilmmaking`: pasting the exact same character prompt and getting three incompatible people.

#### Visual Layout & Choreography

1. **Frames `0 – 30` (0.0s – 0.5s):**
   - Background is `#0d0e14`.
   - Center screen: a dark prompt input bar (`width: 1100px`, `height: 64px`, `bg: #181a24`, `border: 1px solid rgba(255,255,255,0.12)`, `borderRadius: 12px`).
   - Inside the bar, monospace text (`JetBrains Mono`, `20px`, `#d8dae0`) finishes typing at high speed:
     `"Prompt: Mara, 28, yellow rain jacket, rooftop at night, 35mm cinematic..."`
2. **Frames `30 – 120` (0.5s – 2.0s):**
   - Above the prompt bar, three `16:9` shot cards (`width: 480px`, `height: 270px` each, spaced `24px` apart) pop in sequentially at `Frame 35`, `Frame 65`, and `Frame 95` using `PUNCH_IN`.
   - **Card 1 (`SHOT 01`):** Young woman with short dark bob, neon pink cyber jacket, heavy rain. Red badge in top-right: `Seed 48192`.
   - **Card 2 (`SHOT 02`):** Different woman with long blonde hair, matte trench coat, warm sunset lighting. Red badge: `Seed 90314` (`border: 1px solid #e05a47`).
   - **Card 3 (`SHOT 03`):** Different face again, hood up, anime-leaning shading, fog background. Red badge: `Seed 11208` (`border: 1px solid #e05a47`).
   - Beneath the three cards, a red diff comparison line connects the faces with warning tags: `Face drift`, `Wardrobe mismatch`, `Lighting mismatch`.
3. **Frames `120 – 240` (2.0s – 4.0s):**
   - The three mismatched cards dim to `opacity: 0.22` and scale down to `0.94`.
   - Foreground kinetic typography slams in center-screen (`Space Grotesk`, `600`, `72px`, tight `-0.03em` tracking):
     - Line 1 (`Frame 120`, `#d8dae0`): **Same prompt.**
     - Line 2 (`Frame 145`, `#d8dae0`): **Different face.**
     - Line 3 (`Frame 170`, `#d6f01a`): **Every shot.**

---

### SCENE 02: The Problem (15 Tabs & The Spreadsheet Glue)

- **Timecode:** `0:04.00 – 0:11.00` (`Frames 240 – 660` @ 60fps)
- **Narrative Goal:** Mirror the exact workflow AI filmmakers describe on Reddit: juggling 15 browser tabs, tracking seeds and prompts in a spreadsheet, and losing file lineage across downloads.

#### Visual Layout & Choreography

1. **Frames `240 – 360` (4.0s – 6.0s) — The 15-Tab Browser Bar:**
   - Camera pulls back (`scale: 1.0`). At the top of the frame, a browser window header rapidly spawns **15 cramped tabs** (`stagger: 4 frames` per tab):
     `ChatGPT - Script v3` | `Image Gen - Mara Face` | `Image Gen - Rooftop` | `Shot_List_Master.xlsx` | `Video Gen - Queue (4)` | `Video Gen - Tab 2` | `Voice Clone TTS` | `Music Gen` | `Upscaler` | `Drive - Downloads`...
   - A red memory indicator badge pulses on tab 12: `Tab crashed — unsaved prompt lost`.
2. **Frames `360 – 510` (6.0s – 8.5s) — The Spreadsheet & Folder Chaos:**
   - Two overlapping floating windows cascade across the canvas:
     - **Window A (Left-Center): Spreadsheet (`Shot_List_FINAL_v4.xlsx`)** rendered in dark-mode grid (`JetBrains Mono`, `13px`):
       - Columns: `Shot #` | `Locked Prompt Block (Copy/Paste)` | `Ref Image Filename` | `Model` | `Approved Take?`
       - Row 4 is highlighted in red: `Shot 04 | [PASTE MARA DESC HERE] | ???_which_ref.png | Pending | REDO (wasted 80 credits)`.
     - **Window B (Right-Center): OS Downloads Folder** showing chaotic file names:
       - `gen_88412_01.mp4`
       - `mara_rooftop_v2_fixed_face.png`
       - `scene1_shot2_FINAL_actual(1).mp4`
       - `voice_line_take7.wav`
   - An animated cursor drags `scene1_shot2_FINAL_actual(1).mp4` across the screen into a generic third-party video editor dropzone displaying a spinning loader: `Uploading 42%... (No script or scene data attached)`.
3. **Frames `510 – 660` (8.5s – 11.0s) — Kinetic Problem Overlay:**
   - Background windows blur (`backdrop-filter: blur(10px)`) and darken (`opacity: 0.3`).
   - Center kinetic headline (`Space Grotesk`, `64px`, `#d8dae0`):
     **15 tabs. A spreadsheet. Zero memory.**
   - Sub-caption (`Geist`, `26px`, `#6e7385`):
     _Your tools can generate clips. None of them share the production._

---

### SCENE 03: The Collapse & Product Reveal (Sohizi Lab Shell)

- **Timecode:** `0:11.00 – 0:17.00` (`Frames 660 – 1020` @ 60fps)
- **Narrative Goal:** Transform the scattered mess into Sohizi Lab's calm, structured, file-first project workspace (`AppHeader` + `AppNavBar` + `FILES` Explorer + Tabbed Workspace + `Koli` Assistant).

#### Visual Layout & Choreography

1. **Frames `660 – 750` (11.0s – 12.5s) — Magnetic Implosion:**
   - Using spring physics (`stiffness: 180, damping: 22`), the scattered windows (Script doc, Character sheet, Spreadsheet rows, Audio waveforms, Video clips) collapse inward along glowing `#d6f01a` vector lines into a single structured project tree on the left side of the screen.
2. **Frames `750 – 900` (12.5s – 15.0s) — The Full Sohizi Workspace Shell Renders:**
   - The authentic Sohizi Lab dark UI locks into place (`1760x960` frame centered on `#0d0e14` canvas with `border-radius: 16px`, `border: 1px solid rgba(255,255,255,0.1)`):
     - **Top `AppHeader` (`height: 44px`):** Monochrome Sohizi logo on left, sidebar toggle icon, breadcrumb `All Projects / The Last Signal`, right `Focus` button and **Colibri mascot icon** (active lemon-green glow).
     - **Far-Left `AppNavBar` (`width: 48px`):** 4 vertical icons: `Files explorer` (active `#d6f01a` indicator), `AI media generator`, `Video editor`, `Skill market`.
     - **Left `FILES` Panel (`width: 260px`, `bg: #181a24`, `rounded-2xl`):**
       - Header: `FILES`
       - Expanded project tree under `/root`:
         - `📁 core` (blue folder icon)
           - `📄 brief.md` (blue doc icon)
           - `🔍 world-context` (yellow context icon)
         - `📁 characters`
           - `🖼️ mara-ref.png` (green media icon)
           - `🖼️ rooftop-loc.png` (green media icon)
         - `📄 script.md` (blue doc icon — currently active)
         - `🎬 scene-01.storyboard` (pink storyboard icon)
         - `🎞️ the-last-signal.video` (pink video-editor icon)
     - **Center Workspace (`bg: #252836`):** Open tabs for `script.md`, `scene-01.storyboard`, and `the-last-signal.video`.
     - **Right `Koli` Chat Panel (`width: 360px`, `bg: #181a24`):** Header `Koli` with Colibri badge.
3. **Frames `900 – 1020` (15.0s – 17.0s) — Reveal Title Overlay:**
   - Lower-third floating glass banner (`bg: oklch(0.15 0.01 270 / 0.85)`, `backdrop-filter: blur(12px)`, `border: 1px solid rgba(214,240,26,0.3)`):
     - Eyebrow (`JetBrains Mono`, `14px`, `#d6f01a`): `SOHIZI LAB // PROJECT-AWARE WORKSPACE`
     - Headline (`Space Grotesk`, `40px`, `#d8dae0`): **One project that remembers the film you're making.**

---

### SCENE 04: Stage 1 — Write & Direct with Project-Aware AI (Koli)

- **Timecode:** `0:17.00 – 0:23.00` (`Frames 1020 – 1380` @ 60fps)
- **Narrative Goal:** Show how a story starts in `TextEditorView` (`script.md`) and how **Koli** reads existing project files via `@` mentions instead of requiring the user to copy-paste character descriptions.

#### Visual Layout & Choreography

1. **Frames `1020 – 1120` (17.0s – 18.6s) — Script Editor + Chat Input Punch-In:**
   - Camera executes `PUNCH_IN` (`scale: 1.45`, focusing on the center `script.md` editor and right `Koli` chat panel).
   - **Center (`script.md` in `TextEditorView`):** Clean screenplay formatting (`Courier Prime` / `Geist`):
     ```markdown
     # SCENE 01 — EXT. SECTOR 4 ROOFTOP - NIGHT

     Freezing rain hammers rusted satellite dishes.
     MARA (28, yellow high-collar rain jacket) crouches beside a portable analog receiver.
     A red frequency LED begins to pulse.

     MARA
     Signal locked. Sector four.
     ```
   - **Right (`Koli` `ChatInput` footer):** Placeholder reads `"Use @ to reference files and / for commands"`.
   - User types into the chat box (`Frames 1040–1110`), triggering the `@` autocomplete menu (`FileLinkSuggestion`) and inserting two glowing `.file-tag-link` pills (`bg: rgba(214,240,26,0.10)`, `color: #d6f01a`, `border-radius: 9999px`):
     `Break` **`@script.md`** `Scene 1 into a 3-shot storyboard using` **`@mara-ref.png`** `and` **`@rooftop-loc.png`**
2. **Frames `1120 – 1260` (18.6s – 21.0s) — Koli Reads the Project (Collapsible Tool Rows):**
   - User presses Enter (`#d6f01a` send button flashes).
   - Inside Koli's chat thread, three clean collapsible activity rows animate in sequentially (`stagger: 20 frames`, `Geist`, `14px`, `#6e7385` with green checkmarks and `ToolFileTag` pills):
     - `✓ Reading a file` -> `[brief.md](/root/core/brief.md)`
     - `✓ Reading a file` -> `[mara-ref.png](/root/characters/mara-ref.png)`
     - `✓ Writing a file` -> `[scene-01.storyboard](/root/scene-01.storyboard)`
   - Koli replies concisely:
     _"Created 3 coverage shots in **`@scene-01.storyboard`** with Mara's canonical yellow rain jacket and sodium-vapor rooftop lighting locked."_
3. **Frames `1260 – 1380` (21.0s – 23.0s) — Inline Diff Approval:**
   - At the top of the editor, the `MarkdownPendingChangesBar` appears with `Accept Changes` (`#d6f01a` button) and `Reject`.
   - Cursor clicks `Accept Changes` at `Frame 1320`.
   - Top-left kinetic badge (`Space Grotesk`, `28px`): **1. Write with an assistant that read the project.**

---

### SCENE 05: Stage 2 — Storyboard & World Bible (Locking Continuity First)

- **Timecode:** `0:23.00 – 0:30.00` (`Frames 1380 – 1800` @ 60fps)
- **Narrative Goal:** Show `StoryboardEditorView` and the `World` sheet solving character/scene consistency _before_ spending video credits.

#### Visual Layout & Choreography

1. **Frames `1380 – 1500` (23.0s – 25.0s) — Storyboard Scene Card:**
   - `HARD_STATE_CUT` to the `scene-01.storyboard` tab in the center workspace.
   - A vertical scene container card (`bg: #181a24`, `border: 1px solid rgba(255,255,255,0.1)`, `rounded-2xl`, `padding: 24px`) fills the main stage:
     - **Eyebrow (`Space Grotesk`, `13px`, `#d6f01a`, bold):** `SCENE 01`
     - **Scene Title (`22px`, `#d8dae0`):** `Rooftop Signal Intercept`
     - **Metadata Grid (`Geist`, `13px`):**
       - `Environment:` `Rain-slicked concrete rooftop, rusted dishes`
       - `Lighting:` `Cold blue downpour + sodium-vapor rim light`
   - Below the metadata, a **3-column Shot Grid** (`16:9` aspect ratio cards) cascades in (`stagger: 12 frames`):
     - **Shot 01 (Wide Establishing):** Mara silhouetted against wet satellite dishes, yellow jacket catching neon rim light. Camera tag: `24mm Wide · Slow Push-In`.
     - **Shot 02 (Medium Close-Up):** Same exact Mara face & yellow high-collar jacket, adjusting the analog dial, red LED reflection on wet cheek. Camera tag: `50mm MCU · Static`.
     - **Shot 03 (Extreme Close-Up Insert):** Mara's gloved hand locking the frequency switch as the red LED turns solid; Mara's profile consistent in background. Camera tag: `85mm Macro · Rack Focus`.
2. **Frames `1500 – 1680` (25.0s – 28.0s) — Bottom Center Pill Toolbar & World Bible Sheet:**
   - Camera pans slightly down (`PANEL_GLIDE`) to highlight the floating bottom-center pill toolbar (`border-radius: 9999px`, `bg: #181a24`, `border: 1px solid rgba(255,255,255,0.12)`):
     - `[ ▶ View Sequence ]` (styled in `#d6f01a` background with `#111` text) | `[ World ]` | `[ Attach Context ]`
   - The `World` drawer slides open on the right side of the storyboard (`width: 340px`), displaying the locked **World Bible**:
     - `Aspect Ratio:` `16:9 Widescreen`
     - `Visual Style:` `Anamorphic Neo-Noir, Wet Halation`
     - `Locked References:` Thumbnails of `mara-ref.png` (4-angle turnaround sheet) and `rooftop-loc.png` with a green badge: `Linked to 3/3 shots`.
     - `Color Palette Swatches:` `#0B132B` (Midnight Rain), `#D6F01A` (Mara Jacket), `#FF2A54` (Signal LED), `#3A506B` (Wet Concrete).
3. **Frames `1680 – 1800` (28.0s – 30.0s) — Muted Headline Callout:**
   - Top-left kinetic badge (`Space Grotesk`, `28px`): **2. Lock your world and storyboard before spending credits.**

---

### SCENE 06: Stage 3 — Generate Video Takes, Voice & Sound in Context

- **Timecode:** `0:30.00 – 0:37.00` (`Frames 1800 – 2220` @ 60fps)
- **Narrative Goal:** Show Shot 02 moving directly into `MediaGenerator` / `MediaComposer`—generating a 2×2 grid of video takes plus native dialogue/audio without leaving the project.

#### Visual Layout & Choreography

1. **Frames `1800 – 1920` (30.0s – 32.0s) — Shot-to-Generator Handoff:**
   - On `Shot 02` in the storyboard, the hover toolbar appears (`Drag | Attach shot to chat | Generate Video`).
   - Left `AppNavBar` switches active highlight to the 2nd icon (`AI media generator`).
   - Split view opens:
     - **Left (`Media generator` history grid):** Filter pills `All | Image | Video | Audio` (`All` active).
     - **Right (`MediaComposer`):** Header `Video Generator`, subtype tab `From image` active, with `Shot 02 Keyframe` and `mara-ref.png` already pre-attached in the reference slots.
2. **Frames `1920 – 2060` (32.0s – 34.3s) — Lemon-Green Dot Grid Loader -> 2×2 Takes Grid:**
   - Inside the left history grid, a new request card shows Sohizi's signature animated dot-matrix loader (`dotColor: rgb(212, 255, 0)` on `#181a24`) for 35 frames, then resolves via `HARD_STATE_CUT` into a **2×2 grid of 4 video takes** (`Take A`, `Take B`, `Take C`, `Take D`) of Mara speaking into the radio in pouring rain.
   - Cursor hovers `Take B` (best subtle head turn and rain physics) and clicks `Approve & Move to /root/scenes/scene-01`.
3. **Frames `2060 – 2220` (34.3s – 37.0s) — Audio Generation (TTS + Ambience):**
   - Right far-edge type rail highlights `Audio` (`TTS / Music`).
   - Two completed audio cards appear immediately below the video card in the history grid:
     - `🎙️ mara-line-01.wav` — `"Signal locked. Sector four."` (animated lemon-green waveform).
     - `🎵 rooftop-rain-drone.wav` — `"Heavy downpour + analog radio hum"` (animated teal `--chart-5` waveform).
   - Top-left kinetic badge (`Space Grotesk`, `28px`): **3. Generate video, voice, and sound in context.**

---

### SCENE 07: Stage 4 — Assemble the Final Cut in the Built-In Video Editor

- **Timecode:** `0:37.00 – 0:44.00` (`Frames 2220 – 2640` @ 60fps)
- **Narrative Goal:** Prove that the editor is already connected to the project. Approved takes, voice lines, and captions sit in the `Assets` panel ready to drop onto the multi-track timeline—zero exporting or re-uploading.

#### Visual Layout & Choreography

1. **Frames `2220 – 2340` (37.0s – 39.0s) — Video Editor Workspace Layout:**
   - Left `AppNavBar` activates the 3rd icon (`Video editor`).
   - The authentic Sohizi Video Editor composition view fills the workspace:
     - **Top Bar:** `← All videos projects` | Title: `The Last Signal — Scene 01 Cut` | `Saved` | `16:9` | `24 FPS` | `Export` button (`#d6f01a`).
     - **Left Rail + Asset Panel (`Assets | Text | Captions | Adjust`):** `Assets` is open, showing the exact files from the project: `shot-01-wide.mp4`, `shot-02-mara-takeB.mp4`, `shot-03-dial-macro.mp4`, `mara-line-01.wav`, `rooftop-rain-drone.wav`.
     - **Center `Stage` (`player.tsx`):** `16:9` preview monitor + `TransportBar` below (`00:00:04:12 / 00:00:12:00`, play/pause, speed `1x`, fullscreen).
     - **Bottom `Timeline` Card:** `TimelineToolbar` (`Undo`, `Redo`, `Split`, `Delete`, `Insert Text`, `Captions`, zoom slider) + 4 horizontal tracks.
2. **Frames `2340 – 2520` (39.0s – 42.0s) — Magnetic Multi-Track Assembly:**
   - Camera executes `PUNCH_IN` (`scale: 1.35`) focused on the `Stage` and `Timeline`.
   - Clips snap onto the timeline tracks in rhythmic succession (`stagger: 18 frames`):
     - **Track 1 (`Captions` — Purple `#a855f7`):** Auto-synced caption block `[ "Signal locked. Sector four." ]` snaps over Shot 02.
     - **Track 2 (`Video` — Filmstrip thumbnails):** `shot-01-wide.mp4` (`0:00–0:04`) -> `shot-02-mara-takeB.mp4` (`0:04–0:08`) -> `shot-03-dial-macro.mp4` (`0:08–0:12`).
     - **Track 3 (`Voice` — Green waveform `#3ce67a`):** `mara-line-01.wav` aligns under Shot 02.
     - **Track 4 (`Music / SFX` — Teal waveform `#2dd4bf`):** `rooftop-rain-drone.wav` spans the full 12-second sequence.
3. **Frames `2520 – 2640` (42.0s – 44.0s) — Live Scrub & Cut Verification:**
   - The white vertical playhead scrubs smoothly across the cut from `Shot 01` -> `Shot 02` -> `Shot 03`.
   - In the center `Stage` preview, Mara's face, yellow jacket, wet halation lighting, and red LED match across all three cuts.
   - Top-left kinetic badge (`Space Grotesk`, `28px`): **4. Cut the timeline without downloading a single file.**

---

### SCENE 08: The Payoff — Export & Continuous Playback

- **Timecode:** `0:44.00 – 0:48.00` (`Frames 2640 – 2880` @ 60fps)
- **Narrative Goal:** Hold the finished result long enough for the viewer to admire the continuity and see the `Export` completion state.

#### Visual Layout & Choreography

1. **Frames `2640 – 2720` (44.0s – 45.3s) — Export Click:**
   - Top-right `Export` button pulses (`Queued -> Rendering 100% -> Download MP4` with `#d6f01a` fill).
2. **Frames `2720 – 2880` (45.3s – 48.0s) — Full-Bleed Cinema Preview:**
   - The surrounding UI chrome smoothly recedes (`scale: 1.0 -> 1.65` centering the `Stage` player to 80% of the viewport).
   - The finished 3-shot sequence of _"The Last Signal"_ plays at full frame rate with crisp subtitles (`"Signal locked. Sector four."`), rain audio, and zero character drift.
   - Floating bottom caption (`Space Grotesk`, `36px`, `#d8dae0`):
     **One story. Start to final cut.**

---

### SCENE 09: End Card & Call to Action

- **Timecode:** `0:48.00 – 0:52.00` (`Frames 2880 – 3120` @ 60fps)
- **Narrative Goal:** Land a single, unmistakable conversion action aligned with `marketing/lp.md`.

#### Visual Layout & Choreography

1. **Frames `2880 – 2930` (48.0s – 48.8s):**
   - Clean transition to deep `#0d0e14` background with a subtle radial spotlight (`--animate-spotlight`, `rgba(214, 240, 26, 0.08)` at center).
2. **Frames `2930 – 3120` (48.8s – 52.0s):**
   - Center-aligned vertical stack (`stagger: 8 frames` fade-up):
     - **Brand Lockup:** Monochrome Sohizi Lab wordmark + **Colibri** emblem (`height: 48px`).
     - **Category Eyebrow (`JetBrains Mono`, `16px`, `#d6f01a`, letter-spacing `0.08em`):**
       `THE PROJECT-AWARE AI VIDEO WORKSPACE`
     - **Main Headline (`Space Grotesk`, `600`, `64px`, `#d8dae0`, max-width `1100px`):**
       **Start the video in the project you will finish it in.**
     - **Primary CTA Button (`height: 64px`, `padding: 0 40px`, `bg: #d6f01a`, `color: #0d0e14`, `font: Space Grotesk 600 22px`, `borderRadius: 9999px`, `boxShadow: 0 4px 32px rgba(214, 240, 26, 0.35)`):**
       `Create your first project →`
     - **Supporting Subline (`Geist`, `18px`, `#6e7385`, margin-top `16px`):**
       `Your files, scenes, and creative direction stay in one project · sohizi.com`
   - At `Frame 3010`, an animated cursor clicks the `Create your first project →` button, triggering a crisp `1.04x` spring pulse and a soft green ripple ring. Hold cleanly until `Frame 3120`.

---

## 5. Component Tree Blueprint for the Coding Agent

When handing this specification to a coding agent to build in **Remotion** (`@sohizi/video-composition` or standalone Remotion project), instruct the agent to scaffold the following modular component tree:

```
src/launch-video/
├── LaunchVideoComposition.tsx       # Root <Composition id="SohiziLaunch52s" fps={60} durationInFrames={3120} width={1920} height={1080} />
├── tokens.ts                        # SOHIZI_TOKENS, VIDEO_CONFIG, and spring presets (PUNCH_IN, PANEL_GLIDE)
├── components/
│   ├── KineticTitleOverlay.tsx      # Reusable muted-safe headline badge + lower-third glass card
│   ├── SohiziWorkspaceShell.tsx     # Persistent AppHeader + 48px AppNavBar + ResizablePanelGroup shell
│   ├── FileExplorerPanel.tsx        # Left FILES tree (/root/core/brief.md, mara-ref.png, script.md, etc.)
│   ├── KoliChatPanel.tsx            # Right Colibri assistant panel with @file-tag-link pills & tool rows
│   └── AnimatedCursor.tsx           # Deterministic bezier cursor with click ripple state
└── scenes/
    ├── Scene01HookDrift.tsx         # Frames 0–240: Prompt box + 3 mismatched Mara cards + "Same prompt. Different face."
    ├── Scene02TabChaos.tsx          # Frames 240–660: 15 browser tabs + Shot_List.xlsx + Downloads drag spinner
    ├── Scene03WorkspaceReveal.tsx   # Frames 660–1020: Spring implosion into SohiziWorkspaceShell
    ├── Scene04ScriptAndKoli.tsx     # Frames 1020–1380: TextEditorView + Koli @script.md & @mara-ref.png prompt + diff bar
    ├── Scene05StoryboardWorld.tsx   # Frames 1380–1800: SCENE 01 3-column shot grid + World bible drawer + #d6f01a View Sequence pill
    ├── Scene06MediaGenerator.tsx    # Frames 1800–2220: rgb(212,255,0) dot loader -> 2x2 video takes + TTS & rain waveforms
    ├── Scene07VideoEditorCut.tsx    # Frames 2220–2640: Assets panel -> 4-track Timeline assembly + Stage preview scrub
    ├── Scene08ExportPayoff.tsx      # Frames 2640–2880: Export 100% badge + 80% viewport cinema playback of 3-shot sequence
    └── Scene09EndCardCTA.tsx        # Frames 2880–3120: Logo + "Start the video in the project you will finish it in." + "Create your first project →" click
```

### Root Sequence Wiring (`LaunchVideoComposition.tsx`)

```tsx
import React from "react"
import { AbsoluteFill, Sequence } from "remotion"
import { SOHIZI_TOKENS } from "./tokens"
import { Scene01HookDrift } from "./scenes/Scene01HookDrift"
import { Scene02TabChaos } from "./scenes/Scene02TabChaos"
import { Scene03WorkspaceReveal } from "./scenes/Scene03WorkspaceReveal"
import { Scene04ScriptAndKoli } from "./scenes/Scene04ScriptAndKoli"
import { Scene05StoryboardWorld } from "./scenes/Scene05StoryboardWorld"
import { Scene06MediaGenerator } from "./scenes/Scene06MediaGenerator"
import { Scene07VideoEditorCut } from "./scenes/Scene07VideoEditorCut"
import { Scene08ExportPayoff } from "./scenes/Scene08ExportPayoff"
import { Scene09EndCardCTA } from "./scenes/Scene09EndCardCTA"

export const LaunchVideoComposition: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: SOHIZI_TOKENS.colors.background,
        color: SOHIZI_TOKENS.colors.foreground,
        fontFamily: SOHIZI_TOKENS.fonts.sans,
      }}
    >
      {/* Act I: Hook & Problem */}
      <Sequence from={0} durationInFrames={240} name="01-Hook-Character-Drift">
        <Scene01HookDrift />
      </Sequence>

      <Sequence
        from={240}
        durationInFrames={420}
        name="02-Problem-15-Tabs-Spreadsheet"
      >
        <Scene02TabChaos />
      </Sequence>

      {/* Act II: Collapse & Workspace Reveal */}
      <Sequence
        from={660}
        durationInFrames={360}
        name="03-Reveal-Sohizi-Workspace"
      >
        <Scene03WorkspaceReveal />
      </Sequence>

      {/* Act III: End-to-End Story ("The Last Signal") */}
      <Sequence
        from={1020}
        durationInFrames={360}
        name="04-Write-Script-And-Koli"
      >
        <Scene04ScriptAndKoli />
      </Sequence>

      <Sequence
        from={1380}
        durationInFrames={420}
        name="05-Plan-Storyboard-World-Bible"
      >
        <Scene05StoryboardWorld />
      </Sequence>

      <Sequence
        from={1800}
        durationInFrames={420}
        name="06-Generate-Takes-And-Audio"
      >
        <Scene06MediaGenerator />
      </Sequence>

      <Sequence
        from={2220}
        durationInFrames={420}
        name="07-Edit-Connected-Timeline"
      >
        <Scene07VideoEditorCut />
      </Sequence>

      {/* Act IV: Payoff & CTA */}
      <Sequence
        from={2640}
        durationInFrames={240}
        name="08-Payoff-Export-Playback"
      >
        <Scene08ExportPayoff />
      </Sequence>

      <Sequence from={2880} durationInFrames={240} name="09-End-Card-CTA">
        <Scene09EndCardCTA />
      </Sequence>
    </AbsoluteFill>
  )
}
```

### Quality Guardrails for the Motion Graphics Agent

1. **Visual Continuity Across Scenes 04–08:** Every visual representation of **Mara** inside Sohizi Lab (in `mara-ref.png`, `Shot 01–03` storyboard thumbnails, the `2x2` video generation grid, and the `Stage` video player) must depict the **exact same character palette** (short dark hair, high-collar `#d6f01a` yellow rain jacket, dark blue rain background, `#ff2a54` red receiver LED) to visually contrast with the mismatched faces in Scene 01.
2. **Legible UI Scale:** Never render miniature, unreadable 8px UI text during feature scenes. When showing Koli's `@` file pills, the Storyboard cards, or the Timeline tracks, keep camera zoom between `1.35x` and `1.85x` so every pill and label is legible on a phone screen.
3. **Zero AI Cliches:** Do not add glowing robot brains, sparkles, magic wands, or floating neon neural nets. The visual hero is the **connected file tree, the storyboard cards, the `@file` tags, and the timeline tracks**.
