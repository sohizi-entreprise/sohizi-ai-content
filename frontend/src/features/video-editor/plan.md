# Comprehensive Guide for AI Agent: Building an End-to-End React Video Editor

**Context for the AI Agent:**
You are tasked with building a high-performance, production-ready, browser-based video editor. The application must feature a top canvas for video playback, a middle toolbar for controls, and a multi-track bottom timeline. 

You must strictly adhere to the architectural rules, technology stack, and implementation steps detailed in this document. **Do not deviate from the Master-Slave time architecture.**

---

## 1. Core Architectural Rules

*   **Strict Separation of Concerns:** The application must be cleanly divided into three distinct layers: 
    1. The Global State (Source of Truth).
    2. The Rendering Engine (Video Canvas & Time Master).
    3. The Timeline UI (Data Visualization & User Input).
*   **Time Unit Standard:** The global state must store all time values exclusively in **Frames** (integers). Never store decimal seconds in the state. Convert to seconds only at the UI layer for the timeline representation.
*   **The Master-Slave Time Concept:** The video rendering engine is the sole source of truth for the current playhead position. The timeline UI does not use its own playback ticking engine. It only updates its cursor when the rendering engine broadcasts a frame update.
*   **Virtualization:** Do not pass the entire timeline state directly to the UI. You must implement a selector that windows the data, passing only the clips visible within the current timeline viewport (plus a small buffer) to prevent DOM lag.

---

## 2. Technology Stack

*   **State Management:** Zustand (with Immer for mutable syntax on immutable state, and Zundo for Undo/Redo).
*   **Rendering & Playback Engine:** Remotion (specifically `@remotion/player`).
*   **Timeline UI Component:** `@xzdarcy/react-timeline-editor`.
*   **Styling:** Tailwind CSS.

---

## 3. Directory Structure Specification
Put all the code inside `frontend/src/features/video-editor`
Organize the codebase logically to ensure easy debugging:
*   `store` - Contains the Zustand store, strict TypeScript schemas, and the virtualization selector logic.
*   `engine` - Contains the Remotion composition components (Video, Audio, Text mappings).
*   `timeline` - Contains the `@xzdarcy` bridge component and custom block renderers (waveforms, thumbnails).
*   `components` - Contains standard React UI components (Canvas Wrapper, Toolbar, Sidebar, Aspect Ratio dropdowns, etc...).
*   `utils` - Contains pure math functions for converting between frames and seconds.

---

## 4. Phase 1: State Management & Virtualization

**Data Schema:**
Design a hierarchical state structure. The root state should hold project settings (FPS, total duration, current frame, aspect ratio, zoom level). Inside the root, maintain an array of `Tracks`. Each track must have properties for ID, type (video, audio, text), UI toggles (muted, hidden), and an array of `Clips`. Every clip must have an ID, start frame, end frame, source start frame (for trimmed media), and source URL/text data.

**Virtualization Implementation (The Bridge Selector):**
Create a derived state selector. This function should take the entire state, the timeline's current viewport start time, and the viewport end time. 
It must filter out any clips that fall completely outside this viewport (adding a safe buffer of ~50 frames). It then maps these visible clips into the specific object structure required by the `@xzdarcy` timeline data prop, converting the start and end frames into seconds.

**Store Actions:**
Implement atomic update functions. Examples include: adding a track, moving a clip (updating start/end frames), splitting a clip (duplicating a clip and adjusting the start/end frames of both halves based on the playhead), and toggling track visibility/mute.

---

## 5. Phase 2: The Rendering Engine (Remotion)

**The Main Composition:**
Build a Remotion composition that maps over the Zustand tracks and clips. Use Remotion's sequence components to position clips accurately in time based on their frame data. Map video tracks to video components, audio tracks to audio components, and text tracks to text layers. Ensure hidden or muted tracks are not rendered.

**The Player Canvas:**
Wrap the Remotion Player component in your main UI. This player should span the top section of the layout over a dark grid background. 
Configure the Player to read its FPS, duration, and dimensions directly from the Zustand store. Disable the Player's default UI controls.
Most importantly, attach a listener to the Player's frame update event. When the Player ticks, update the `currentFrame` property in the Zustand store.

---

## 6. Phase 3: The Timeline UI (`@xzdarcy`)

**The UI Bridge:**
Implement the `@xzdarcy` timeline component at the bottom of the layout. Feed it the data from your Virtualization Selector, not the raw state.

**Handling User Interactions:**
*   **Dragging/Resizing:** When a user drags or trims a clip on the timeline, `@xzdarcy` fires action events containing the new times in seconds. Catch these events, convert the new times back into frames using your math utility, and trigger the corresponding Zustand update actions.
*   **Seeking:** When a user clicks the timeline ruler, capture the time in seconds, convert it to frames, update the state playhead, and use a React Ref to programmatically seek the Remotion Player to that exact frame.
*   Track reordering
*   clip splitting
*   zoom handling
*   Drag and drop

**Custom Track Aesthetics (From Image):**
Use `@xzdarcy`'s custom rendering props to style the clips based on their track type.
*   **Video Blocks:** Render a blue background. Inside, render a repeating flex-row of video thumbnail images to simulate a filmstrip.
*   **Text Blocks:** Render a solid blue background with a text icon and the text string truncated.
*   **Audio Blocks:** Render an orange background. Inside, render an SVG or Canvas-based audio waveform representation.
*   **Track Headers:** On the left side of the timeline, implement the track control headers featuring hide (eye icon), mute (speaker icon), delete, and drag-to-reorder handles.

---

## 7. Phase 4: Toolbar & Controls

Implement a toolbar situated between the Canvas and the Timeline. It should interact entirely with the Zustand store and Remotion Player Ref.

**Required Controls:**
1.  **Undo/Redo Buttons:** Hook these up to the Zundo middleware.
2.  **Split Button (Scissors icon):** When clicked, find the currently selected clip that intersects with the `currentFrame`. Execute the split action in Zustand.
3.  **Playback Controls:** Play, pause, skip to start, skip to end. These must trigger the Remotion Player Ref methods.
4.  **Timecode Display:** Display the current time formatted as `MM:SS:ms / Total MM:SS:ms`.
5.  **Aspect Ratio Selector:** A dropdown (e.g., 16:9, 9:16) that updates the root state, instantly resizing the Remotion Player canvas.
6.  **Zoom Slider:** Updates the `zoomScale` in the state, which is passed down to control the horizontal scale of the `@xzdarcy` timeline.
