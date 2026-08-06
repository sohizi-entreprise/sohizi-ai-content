# Shot Spec: An Atomic, AI-Native Data Structure for Video Shots

**Purpose:** Define a single data structure that represents one *shot* (the atomic unit of a video) with enough information and references to (1) generate media with **high visual/audio consistency**, (2) guarantee **continuity** between shots, scenes, and the whole story, (3) be **easy for an AI to read and update**, and (4) **compile** deterministically into a storyboard and a video timeline.

This document is a proposition. It defines the design principles, the schema, the supporting registries, and a fully worked example based on `4_scenes.md` (*The Cosmic Cipher*).

---

## 1. Core idea: separate the "shot" from the "bibles"

The single biggest cause of inconsistency in AI-generated video is **re-describing the same entity differently in every prompt** ("a 12-year-old boy" vs "young kid with brown hair"). Two shots of Leo end up looking like two different people.

The fix is a **normalized model**: describe each stable entity **once** in a registry ("bible"), give it a stable ID, and have every shot **reference it by ID** instead of re-describing it.

```
project.yaml            # global settings, style, palette, models, aspect ratio
registry/
  characters.yaml       # each character described ONCE, with anchor images + seed
  locations.yaml        # each location/set described ONCE
  props.yaml            # recurring objects (the puzzle, the sphere...)
  styles.yaml           # named look/lighting/lens presets
scenes/
  scene_01.yaml         # ordered list of shot IDs + scene-level continuity
shots/
  S01_SH010.yaml        # <-- THE ATOMIC UNIT. one file = one shot
  S01_SH020.yaml
  ...
```

A shot is therefore **small and self-contained in intent, but linked by reference for identity.** The AI reads a shot plus the bibles it points to and has everything it needs — nothing more to hunt for, nothing duplicated to drift.

---

## 2. Design principles (why the schema looks the way it does)

| Principle | How the schema enforces it |
|---|---|
| **Reference, don't repeat** | Entities (character/location/prop/style) are IDs. Consistency lives in one place. |
| **Deterministic** | Every generative field carries `seed`, `model`, and `params`. Re-running reproduces the frame. |
| **Anchored** | Identity is pinned by `reference_images` (image-to-image / IP-adapter), not just text. |
| **Continuity is explicit** | A `continuity` block states what carries in from the previous shot and what hands off to the next. |
| **Frame-first, then motion** | A shot defines `first_frame` and (optional) `last_frame` keyframes; video is the interpolation/animation between them. This is how most image→video pipelines actually work. |
| **AI-friendly** | Flat, predictable keys; controlled vocabularies (enums); IDs are human-readable; every field has one obvious meaning; free-text is fenced into named prompt fields. |
| **Composable** | Timing + ordering + transitions live on the shot, so a compiler can concatenate shots into a timeline with zero extra info. |
| **Versioned & auditable** | `status`, `version`, and `generations[]` track the lifecycle so an agent knows what's approved vs. draft. |

---

## 3. The Shot schema

One shot = one YAML file (or one object in an array). Fields marked `→ref` are IDs into a registry.

```yaml
# shots/S01_SH010.yaml
id: S01_SH010              # SCENE_SHOT, zero-padded, sortable. This IS the timeline order key.
scene_id: SCENE_01         # →ref scenes/
sequence: 10               # order within scene (gaps of 10 allow inserts: 15, 12...)
version: 3
status: approved           # draft | generating | review | approved | locked

# --- WHAT THE SHOT IS ABOUT (story layer) -----------------------------------
summary: "Leo snaps a puzzle piece into place; it begins to glow."
beat: "inciting_incident"  # story function of this shot
dialogue:                  # timestamped, drives lip-sync + audio + subtitle
  - character: CHAR_LEO     # →ref
    line: "If the sine of the angle equals the mass divided by..."
    tone: "muttering, focused"
    start_s: 0.5
    end_s: 3.2

# --- WHO / WHERE / WHAT (references, NOT descriptions) -----------------------
location: LOC_LEO_BEDROOM   # →ref registry/locations.yaml
time_of_day: night          # enum
characters:
  - ref: CHAR_LEO           # →ref registry/characters.yaml
    blocking: "seated at desk, hunched forward, right hand on puzzle"
    expression: "furrowed brow, intense concentration"
    wardrobe: WARD_LEO_PAJAMAS   # →ref (variant of the character)
props:
  - ref: PROP_PUZZLE          # →ref; state matters for continuity
    state: "one metallic piece being pressed into place, faint blue glow starting"

# --- HOW IT LOOKS (camera + style) ------------------------------------------
style: STYLE_COSMIC_CIPHER    # →ref registry/styles.yaml (the film's master look)
camera:
  shot_size: MCU              # ECU|CU|MCU|MS|MLS|WS|EWS
  angle: eye_level            # low|high|eye_level|overhead|dutch
  lens_mm: 50
  movement: slow_push_in      # static|pan|tilt|dolly|push_in|pull_out|handheld|crane
  focus: "shallow, subject sharp, background bokeh"
  framing: "Leo left-third, puzzle in foreground"
lighting: "single warm desk lamp, hard shadows, dark room, blue glow accent from puzzle"
palette: PAL_ACT1_WARM_DARK   # →ref

# --- HOW TO GENERATE IT (media blueprint) -----------------------------------
media:
  aspect_ratio: "16:9"
  duration_s: 4.0
  first_frame:              # keyframe A — generate as still, then animate
    engine: image
    model: "flux-1.1-pro"
    prompt: >
      MCU, eye-level 50mm, shallow focus. A 12-year-old boy [CHAR_LEO] hunched at a
      cluttered desk in a dark bedroom [LOC_LEO_BEDROOM], pressing a metallic piece into
      an antique geometric puzzle [PROP_PUZZLE]. Single warm desk lamp, hard shadows.
      A faint icy-blue glow begins on the puzzle. Cinematic, [STYLE_COSMIC_CIPHER].
    reference_images:       # <-- consistency anchors, resolved from the refs above
      - CHAR_LEO.anchor
      - LOC_LEO_BEDROOM.anchor
      - PROP_PUZZLE.anchor
    seed: 771034
    negative: "extra fingers, distorted face, bright room, daylight"
  last_frame:               # keyframe B — optional; defines end state for continuity
    prompt: >
      Same framing. The blue glow on the puzzle is now clearly visible, lighting Leo's
      face from below. His hand pulling back slightly, startled.
    seed: 771034            # same seed family keeps the frame coherent
  motion:                   # image→video stage
    engine: video
    model: "kling-2.1 / veo-3 / runway-gen4"
    prompt: "slow push-in; subtle glow intensifies; boy's hand recoils at the end"
    motion_strength: 0.3
    fps: 24
  audio:
    dialogue_ref: CHAR_LEO.voice   # TTS/voice-clone profile
    sfx: ["room tone, quiet", "faint rising hum at 3.0s"]
    music: MUSIC_TENSION_BUILD     # →ref; or null
    ambience: "quiet night bedroom"

# --- CONTINUITY (the glue between atoms) ------------------------------------
continuity:
  carries_in_from: null            # first shot of film
  hands_off_to: S01_SH020
  time_continuous: true            # is the cut continuous in story-time?
  state_deltas:                    # what THIS shot changes about the world
    - "PROP_PUZZLE: dormant -> glowing"
  must_match_previous: []          # e.g. ["CHAR_LEO.wardrobe", "lighting"]
  must_match_next:
    - "CHAR_LEO.position"          # next shot must start where this ends
    - "PROP_PUZZLE.state=glowing"
  screen_direction: "left-to-right"  # preserves the 180-degree rule across cuts

# --- TIMELINE / STORYBOARD COMPILATION --------------------------------------
timeline:
  transition_in: cut              # cut|dissolve|fade_in|match_cut|wipe
  transition_out: cut
  # absolute start is computed by the compiler from ordered durations; not hand-set.

# --- LIFECYCLE / AUDIT ------------------------------------------------------
generations:                      # history so an AI knows what already exists
  - asset: "renders/S01_SH010_v3.mp4"
    frame_a: "renders/S01_SH010_v3_A.png"
    created: "2026-07-31T14:00:00Z"
    approved: true
notes: "Glow must stay subtle here — the big reveal is SH040."
```

---

## 4. Supporting registries (defined once, referenced everywhere)

These are what make consistency possible. Each entry has a **stable ID**, a **canonical text description**, and one or more **anchor images** + a **seed** so every shot renders the "same" thing.

```yaml
# registry/characters.yaml
CHAR_LEO:
  name: "Leo"
  canonical_description: >
    12-year-old boy, slim, messy dark-brown hair, pale skin, expressive brown eyes,
    slightly oversized band t-shirt. Curious, intense.
  anchor_images: ["anchors/leo_front.png", "anchors/leo_profile.png"]
  seed: 771034                  # reused across shots to stabilize identity
  voice: { model: "elevenlabs:xyz", pitch: "young male" }
  wardrobe_variants:
    WARD_LEO_PAJAMAS: "grey pajama top, plaid bottoms"
    WARD_LEO_DAY: "green hoodie, jeans"
```

```yaml
# registry/locations.yaml
LOC_LEO_BEDROOM:
  canonical_description: >
    Small cluttered bedroom at night. Walls covered in equations and star charts.
    One warm desk lamp. Dark, moody.
  anchor_images: ["anchors/bedroom_wide.png"]
LOC_NEON_ARENA:
  canonical_description: >
    Vast crystalline dome in deep space, polished obsidian floor, cold blue/white
    sterile geometric lighting, nebula overhead.
  anchor_images: ["anchors/arena_wide.png"]
```

```yaml
# registry/props.yaml
PROP_PUZZLE:
  canonical_description: "Antique multi-faceted geometric metal puzzle, fits in a hand."
  anchor_images: ["anchors/puzzle.png"]
  states: ["dormant", "glowing", "hovering", "vortex", "final_golden_piece"]
```

```yaml
# registry/styles.yaml
STYLE_COSMIC_CIPHER:
  look: "cinematic sci-fi, filmic grain, high contrast, anamorphic"
  render_model: "flux-1.1-pro"
  default_negative: "cartoon, low-res, watermark, deformed hands"
PAL_ACT1_WARM_DARK: { primary: "#1a1207", accent: "#3fb6ff", note: "warm dark + icy blue accent" }
PAL_ARENA_COLD:      { primary: "#0a1420", accent: "#ffffff", note: "sterile blue/white" }
```

---

## 5. How continuity is guaranteed (the hardest part)

Continuity is not left to chance in prompts — it is **encoded as data** and enforceable by a validator/agent:

1. **Identity anchoring** — every character/prop/location resolves to the *same* anchor images and seed in every shot, so they look identical shot-to-shot.
2. **State machine on props & characters** — `state_deltas` + `must_match_next` mean a linter can flag: "SH010 leaves the puzzle *glowing*, but SH020 shows it *dormant*." Broken continuity becomes a caught error, not a surprise in the edit.
3. **Handoff frames** — a shot's `last_frame` should visually match the next shot's `first_frame` at continuous cuts (feed frame B as a reference image into shot N+1's frame A).
4. **Screen direction / 180° rule** — `screen_direction` is carried so cuts don't flip the geography.
5. **Arc-level continuity** — palette references (`PAL_ACT1_WARM_DARK` → `PAL_ARENA_COLD` → warm golden climax) let the whole story's visual progression be tracked and validated across scenes.

---

## 6. How it compiles to storyboard + timeline

Because every shot carries ordering, duration, and transitions, compilation is mechanical:

- **Storyboard** = for each shot in `id` order, render `media.first_frame` (a still) into a board cell annotated with `summary`, `camera`, and `dialogue`. No extra data needed.
- **Video timeline** = sort shots by `id`; compute `start_s` cumulatively from `duration_s`; lay `motion` clips on the video track, `dialogue`/`sfx`/`ambience`/`music` on audio tracks, and `transition_in/out` between clips. This maps directly onto an NLE / EDL / OTIO export.

```
timeline (computed)
| S01_SH010 [0.0–4.0]  cut | S01_SH020 [4.0–7.5] cut | S01_SH030 ...
audio: dialogue ── sfx(hum@3.0) ── music(tension) ── ambience
```

---

## 7. Why this is AI-friendly to read and update

- **One shot = one small object** → fits in context, cheap to load/edit in isolation.
- **Controlled vocabularies (enums)** for camera, transitions, status → the model picks from a known set instead of inventing phrasing.
- **IDs, not prose, for entities** → updating Leo's look in one registry entry re-propagates to every shot automatically; no find-and-replace across 200 prompts.
- **Named prompt fields** (`first_frame.prompt`, `motion.prompt`) → free text is quarantined where it belongs; structural fields stay machine-parseable.
- **Explicit deltas and match-constraints** → an agent editing shot N can *reason locally* about what it must preserve, and a validator can check it.
- **Deterministic knobs** (`seed`, `model`, `params`) → regeneration is reproducible and diffable.

---

## 8. Suggested next step

If this proposition is approved, I'd recommend:
1. Create `registry/` with `characters/locations/props/styles` for *The Cosmic Cipher* (5 chars/locations, ~4 props).
2. Break `4_scenes.md` into `shots/` files using this schema (est. ~25–35 shots for 5 min).
3. Add a JSON Schema (`shot.schema.json`) so shots can be validated and the continuity linter can run in CI.

Formats: **YAML is recommended** for authoring (readable, comment-friendly, diff-friendly); a JSON Schema governs validity; export to **OTIO/EDL** for the final timeline.
