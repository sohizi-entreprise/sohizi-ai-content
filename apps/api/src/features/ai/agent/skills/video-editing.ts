export const htmlVideoEditingSkill = () => `
Motion graphics, kinetic typography, animated title cards, HTML explainers, beat-synced visuals, caption overlays, and scene transitions.

The host injects GSAP 3 in <head> before your scripts run. Do NOT add a gsap <script> tag.
Put timeline setup in an inline <script> at the end of <body> so \`gsap\` is defined.

HARD RULES — these break host rendering if violated:

1. GSAP timeline MUST be created with { paused: true }.
   Never call .play() — the host controls playback.

2. Register EVERY timeline:
   window.__timelines = window.__timelines || {};
   window.__timelines["<composition-id>"] = tl;

3. NO Math.random(), Date.now(), or wall-clock logic.
   Animations must be deterministic frame-to-frame.
   (Math.ceil / Math.floor for finite repeats are fine.)

4. NO repeat: -1. Always finite repeats, e.g.:
   repeat: Math.ceil(duration / cycleDuration) - 1

5. Build timelines SYNCHRONOUSLY — never inside async/await,
   setTimeout, or Promises.

ANIMATION GUIDELINES (prefer these; keep the timeline deterministic):

6. Prefer gsap.from() for entrances into the CSS hero state.
   Use gsap.to() for scene-to-scene transitions and for the final-scene exit.
   Mid-composition exits are allowed when they create a transition into the next scene.

7. LAYOUT BEFORE ANIMATION:
   - Write static CSS for the hero frame (max visibility) first.
   - Animate FROM the start state TO the CSS position using gsap.from() where possible.
   - Prefer padding + flex over hardcoded absolute pixel positions; absolute positioning is OK when needed for overlays/precise motion.

8. Elements that appear during the composition should animate in — avoid popping on fully formed with no motion.

9. Multi-scene compositions should crossfade, wipe, or otherwise transition between scenes — avoid hard jump cuts when practical.

10. Prefer max-width wrapping over <br> in text content.

DATA ATTRIBUTES (required on every clip element):
  data-start="0"              (seconds, or clip-id reference)
  data-duration="10"          (seconds)
  data-track-index="1"        (integer; same-track clips cannot overlap)

VIDEO: always muted + playsinline. Audio always as a separate <audio> element.

COMPOSITION ROOT (standalone file):
  Put data-composition-id on <body> (or <html>). No <template> wrapper.
  Include data-width / data-height when not 1920×1080.

Deliver the composition ONLY through the submitHtmlComposition tool (status "done"), not as chat text.
The host will call window.__timelines["<id>"].seek(t) on every frame.

---
### VARIABLES — declare on the <html> root using data-composition-variables when copy/colors should be editable:

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

Prefer declaring variables for user-facing text, brand colors, and toggles so the asset stays customizable.
`
