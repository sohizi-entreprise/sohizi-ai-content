

export const htmlVideoEditingSkill = () => `
## HTML type VIDEO GENERATION SKILL
---
Use this skill when asked to build any HTML-based video content, add captions or subtitles synced to audio, generate text-to-speech narration,
create audio-reactive animation (beat sync, glow, pulse driven by music), add animated text highlighting (marker sweeps, hand-drawn circles, burst lines, scribble, sketchout), 
or add transitions between scenes (crossfades, wipes, reveals, shader transitions).
You are generating a HyperFrames composition (plain HTML + GSAP).

The host injects GSAP 3 in <head> before your scripts run. Do NOT add a gsap <script> tag.
Put timeline setup in an inline <script> at the end of <body> so \`gsap\` is defined.

HARD RULES — violating any of these breaks rendering:

1. GSAP timeline MUST be created with { paused: true }.
   Never call .play() — the host controls playback.

2. Register EVERY timeline:
   window.__timelines = window.__timelines || {};
   window.__timelines["<clip-id>"] = tl;

3. NO Math.random(), Date.now(), or wall-clock logic.
   Animations must be deterministic frame-to-frame.

4. NO repeat: -1. Always finite repeats:
   repeat: Math.ceil(duration / cycleDuration) - 1

5. Build timelines SYNCHRONOUSLY — never inside async/await,
   setTimeout, or Promises.

6. Animate with gsap.from() for entrances, gsap.to() only on
   the FINAL scene for exits. No exit tweens between scenes.

7. LAYOUT BEFORE ANIMATION:
   - Write static CSS for the hero frame (max visibility) first.
   - Animate FROM the start state TO the CSS position using gsap.from().
   - Never hardcode absolute pixel positions — use padding + flex.

8. Every element that appears must animate IN. No element may
   appear fully-formed.

9. Every multi-scene composition MUST have transitions between
   scenes. No jump cuts.

10. NO <br> in text content — use max-width for wrapping instead.

DATA ATTRIBUTES (required on every clip element):
  data-start="0"              (seconds, or clip-id reference)
  data-duration="10"          (seconds)
  data-track-index="1"        (integer; same-track clips cannot overlap)

VIDEO: always muted + playsinline. Audio always as a separate <audio> element.

COMPOSITION ROOT (standalone file, not sub-composition):
  Put data-composition-id directly in <body> — no <template> wrapper.

OUTPUT: a single HTML file with inline CSS and JS (GSAP is provided by the host).
The host will call window.__timelines["<id>"].seek(t) on every frame.

---
### VARIABLES — declare on the <html> root using data-composition-variables:

<html
  data-composition-id="{compositionId}"
  data-composition-variables='[
    {"id":"headline",     "type":"string",  "label":"Headline",       "default":"Your text here"},
    {"id":"primaryColor", "type":"color",   "label":"Primary color",  "default":"#3b82f6"},
    {"id":"opacity",      "type":"number",  "label":"Overlay opacity","default":0.6,"min":0,"max":1},
    {"id":"showBadge",    "type":"boolean", "label":"Show badge",     "default":true}
  ]'
>

Reference CSS variables in styles:   var(--hf-primaryColor), var(--hf-opacity)
Reference content in JS:             window.__hfConfig?.headline ?? "Your text here"

---
### FLOW INSTRUCTIONS
1. Before creating any HTML-based video content, ensure there is a html track in the timeline. You can either create a new use or reuse an existing one depending on the goal.
2. Before starting writing the actual html content make sure that there is a html clip associated. If there is no clip, create it first. This is critical because rendering the html depends on the clip id.
3. Write a self-contained HTML composition following the rules and instructions provided in the skill.
`
