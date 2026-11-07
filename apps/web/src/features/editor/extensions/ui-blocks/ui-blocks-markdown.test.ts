// @vitest-environment jsdom
import { Editor } from "@tiptap/core"
import TextAlign from "@tiptap/extension-text-align"
import { Markdown, MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import { describe, expect, it } from "vitest"
import { getMarkdownChangeHunks } from "../../diff-markdown"
import { resolveRejectedMarkdown } from "../../pending-changes"
import { EditorLink } from "../editor-link"
import { uiBlockExtensions } from "./index"

function createManager() {
  return new MarkdownManager({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      EditorLink,
      ...uiBlockExtensions,
    ],
    markedOptions: {
      gfm: true,
    },
  })
}

const SAMPLE_MEDIA = `:::media
type: image
url: https://example.com/frame.jpg
alt: Wide establishing shot of the wet street
:::`

const SAMPLE_SOURCES = `:::sources
- [Neo-Noir Lighting](https://example.com/noir)
  | Film lighting techniques

- [Blade Runner Visual Analysis](https://example.com/blade-runner)
  | Atmospheric color and composition

- [1970s Cinematography](https://example.com/1970s)
  | Vintage lenses and film grain
:::`

const SAMPLE_PALETTE = `:::palette
- #1a1a1a | Background Noir
- #c4a574 | Warm Key Light
- #e63946 | Danger Accent
:::`

const SAMPLE_CARD = `:::card
title: The Last Broadcast
subtitle: Film concept
badge: Concept
image: https://example.com/concept.jpg

A lonely radio host receives a mysterious transmission from a city that no longer exists.

**Genre:** Sci-fi thriller

**Tone:** Melancholic, mysterious
:::`

const SAMPLE_MOODBOARD = `:::moodboard
title: Visual Atmosphere

- https://example.com/street.jpg | Wet streets
- https://example.com/portrait.jpg | Character lighting
- https://example.com/interior.jpg | Interior atmosphere
- https://example.com/texture.jpg | Film grain
:::`

const SAMPLE_TIMELINE = `:::timeline
title: The Last Broadcast

- 8s | The mysterious signal | scene-01
- 12s | Entering the abandoned city | scene-02
- 6s | Discovering the truth | scene-03
- 4s | Final reveal | scene-04
:::`

const SAMPLE_PROPERTIES = `:::properties
title: Video Specifications
layout: grid
- Duration: 8s
- Aspect Ratio: 16:9
- Camera: Wide shot
- Mood: Suspenseful
:::`

const SAMPLE_ATTRIBUTES = `:::attributes
title: Creative Direction

- Visual Style:
  1970s neo-noir cinematography with deep shadows,
  wet pavement, and subtle analog film grain.

- Camera Movement:
  Slow, deliberate tracking shots that gradually
  reveal the environment.

- Lighting:
  Warm sodium-vapor streetlights contrasting
  with cool blue ambient shadows.
:::`

const SAMPLE_TREE = `:::tree
- Video Production | 30-second cinematic brand film
  - Pre-production | Creative direction and planning
    - Script Development | Narrative, dialogue and scene structure
    - Storyboard | Visual composition and shot references
  - Production | Generate and assemble visual assets
    - Scene 01 — The Discovery | An unexpected signal appears in the city
      - Opening wide shot | 8s, slow cinematic dolly-in
      - Character close-up | 4s, emotional reaction
  - Post-production | Editing, sound and final delivery
    - Sound Design | Music, ambience and voiceover
:::`

const SAMPLE_BADGE_PARAGRAPH =
  "Project status: :badge[Approved]{color=highlight} with :badge[Audio Pending]{color=warning}"

describe("Document UI blocks round-trip serialization", () => {
  const manager = createManager()

  it("round-trips :::media identically", () => {
    const doc = manager.parse(SAMPLE_MEDIA)
    expect(doc.content?.[0]).toMatchObject({
      type: "mediaBlock",
      attrs: {
        type: "image",
        url: "https://example.com/frame.jpg",
        alt: "Wide establishing shot of the wet street",
      },
    })
    expect(manager.serialize(doc)).toBe(SAMPLE_MEDIA)
  })

  it("round-trips :::sources identically", () => {
    const doc = manager.parse(SAMPLE_SOURCES)
    expect(doc.content?.[0]?.type).toBe("sourcesBlock")
    expect(doc.content?.[0]?.attrs?.items).toEqual([
      {
        title: "Neo-Noir Lighting",
        url: "https://example.com/noir",
        description: "Film lighting techniques",
      },
      {
        title: "Blade Runner Visual Analysis",
        url: "https://example.com/blade-runner",
        description: "Atmospheric color and composition",
      },
      {
        title: "1970s Cinematography",
        url: "https://example.com/1970s",
        description: "Vintage lenses and film grain",
      },
    ])
    expect(manager.serialize(doc)).toBe(SAMPLE_SOURCES)

    const titledSources = SAMPLE_SOURCES.replace(
      ":::sources\n",
      ":::sources\ntitle: Cinematography Research\n\n",
    )
    const titledDoc = manager.parse(titledSources)
    expect(titledDoc.content?.[0]?.attrs?.title).toBe("Cinematography Research")
    expect(manager.serialize(titledDoc)).toBe(titledSources)
  })

  it("round-trips :::palette identically", () => {
    const doc = manager.parse(SAMPLE_PALETTE)
    expect(doc.content?.[0]?.type).toBe("paletteBlock")
    expect(doc.content?.[0]?.attrs?.swatches).toEqual([
      { color: "#1a1a1a", label: "Background Noir" },
      { color: "#c4a574", label: "Warm Key Light" },
      { color: "#e63946", label: "Danger Accent" },
    ])
    expect(manager.serialize(doc)).toBe(SAMPLE_PALETTE)
  })

  it("round-trips :::card with rich Markdown body identically", () => {
    const doc = manager.parse(SAMPLE_CARD)
    const card = doc.content?.[0]
    expect(card?.type).toBe("cardBlock")
    expect(card?.attrs).toEqual({
      title: "The Last Broadcast",
      subtitle: "Film concept",
      badge: "Concept",
      image: "https://example.com/concept.jpg",
    })
    expect(card?.content).toHaveLength(3)
    expect(manager.serialize(doc)).toBe(SAMPLE_CARD)
  })

  it("round-trips :::moodboard identically", () => {
    const doc = manager.parse(SAMPLE_MOODBOARD)
    expect(doc.content?.[0]).toMatchObject({
      type: "moodboardBlock",
      attrs: {
        title: "Visual Atmosphere",
        columns: 2,
      },
    })
    expect(manager.serialize(doc)).toBe(SAMPLE_MOODBOARD)
  })

  it("seeds 4 placeholders by default when inserting a new moodboard and preserves them across markdown round-trips", () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        EditorLink,
        ...uiBlockExtensions,
        Markdown.configure({ markedOptions: { gfm: true } }),
      ],
      content: "",
    })

    editor.chain().insertMoodboardBlock().run()
    const md = editor.getMarkdown()
    const reparsed = manager.parse(md)
    expect(reparsed.content?.[0]?.attrs?.items).toHaveLength(4)

    editor.destroy()
  })

  it("round-trips :::timeline identically", () => {
    const doc = manager.parse(SAMPLE_TIMELINE)
    expect(doc.content?.[0]).toMatchObject({
      type: "timelineBlock",
      attrs: {
        title: "The Last Broadcast",
      },
    })
    expect(manager.serialize(doc)).toBe(SAMPLE_TIMELINE)
  })

  it("round-trips :::properties across grid, list, and inline layouts", () => {
    const doc = manager.parse(SAMPLE_PROPERTIES)
    expect(doc.content?.[0]).toMatchObject({
      type: "propertiesBlock",
      attrs: {
        title: "Video Specifications",
        layout: "grid",
        items: [
          { key: "Duration", value: "8s" },
          { key: "Aspect Ratio", value: "16:9" },
          { key: "Camera", value: "Wide shot" },
          { key: "Mood", value: "Suspenseful" },
        ],
      },
    })
    expect(manager.serialize(doc)).toBe(SAMPLE_PROPERTIES)

    for (const layout of ["list", "inline"] as const) {
      const variant = SAMPLE_PROPERTIES.replace(
        "layout: grid",
        `layout: ${layout}`,
      )
      const parsedVariant = manager.parse(variant)
      expect(parsedVariant.content?.[0]?.attrs?.layout).toBe(layout)
      expect(manager.serialize(parsedVariant)).toBe(variant)
    }
  })

  it("round-trips :::attributes identically", () => {
    const doc = manager.parse(SAMPLE_ATTRIBUTES)
    expect(doc.content?.[0]).toMatchObject({
      type: "attributesBlock",
      attrs: {
        title: "Creative Direction",
        items: [
          {
            label: "Visual Style",
            value:
              "1970s neo-noir cinematography with deep shadows,\nwet pavement, and subtle analog film grain.",
          },
          {
            label: "Camera Movement",
            value:
              "Slow, deliberate tracking shots that gradually\nreveal the environment.",
          },
          {
            label: "Lighting",
            value:
              "Warm sodium-vapor streetlights contrasting\nwith cool blue ambient shadows.",
          },
        ],
      },
    })
    expect(manager.serialize(doc)).toBe(SAMPLE_ATTRIBUTES)
  })

  it("round-trips :::tree hierarchy identically", () => {
    const doc = manager.parse(SAMPLE_TREE)
    expect(doc.content?.[0]).toMatchObject({
      type: "treeBlock",
      attrs: {
        title: "",
        items: [
          {
            label: "Video Production",
            description: "30-second cinematic brand film",
            depth: 0,
          },
          {
            label: "Pre-production",
            description: "Creative direction and planning",
            depth: 1,
          },
          {
            label: "Script Development",
            description: "Narrative, dialogue and scene structure",
            depth: 2,
          },
          {
            label: "Storyboard",
            description: "Visual composition and shot references",
            depth: 2,
          },
          {
            label: "Production",
            description: "Generate and assemble visual assets",
            depth: 1,
          },
          {
            label: "Scene 01 — The Discovery",
            description: "An unexpected signal appears in the city",
            depth: 2,
          },
          {
            label: "Opening wide shot",
            description: "8s, slow cinematic dolly-in",
            depth: 3,
          },
          {
            label: "Character close-up",
            description: "4s, emotional reaction",
            depth: 3,
          },
          {
            label: "Post-production",
            description: "Editing, sound and final delivery",
            depth: 1,
          },
          {
            label: "Sound Design",
            description: "Music, ambience and voiceover",
            depth: 2,
          },
        ],
      },
    })
    expect(manager.serialize(doc)).toBe(SAMPLE_TREE)

    const titledTree = SAMPLE_TREE.replace(
      ":::tree\n",
      ":::tree\ntitle: Production Breakdown\n\n",
    )
    const titledDoc = manager.parse(titledTree)
    expect(titledDoc.content?.[0]?.attrs?.title).toBe("Production Breakdown")
    expect(manager.serialize(titledDoc)).toBe(titledTree)
  })

  it("preserves trailing spaces in normalizeTreeItems while editing and trims when serializing", () => {
    const normalized =
      createManager().parse(SAMPLE_TREE).content?.[0]?.attrs?.items
    expect(normalized).toBeDefined()

    const withTrailingSpace = [
      {
        label: "Video Production ",
        description: "30-second cinematic brand film ",
        depth: 0,
      },
    ]

    const docWithSpaces = {
      type: "doc",
      content: [
        {
          type: "treeBlock",
          attrs: {
            title: "",
            items: withTrailingSpace,
          },
        },
      ],
    }

    // In-memory normalization keeps trailing spaces so users can type multi-word strings
    expect(docWithSpaces.content[0]?.attrs.items[0]?.label).toBe(
      "Video Production ",
    )
    expect(docWithSpaces.content[0]?.attrs.items[0]?.description).toBe(
      "30-second cinematic brand film ",
    )

    // Markdown serialization trims cleanly
    expect(manager.serialize(docWithSpaces)).toBe(
      ":::tree\n- Video Production | 30-second cinematic brand film\n:::",
    )
  })

  it("round-trips inline :badge[label]{color=...} identically", () => {
    const doc = manager.parse(SAMPLE_BADGE_PARAGRAPH)
    expect(manager.serialize(doc)).toBe(SAMPLE_BADGE_PARAGRAPH)
  })

  it("round-trips :::center and :::right fences with rich Markdown and leaves left alignment unwrapped", () => {
    const alignedDoc = [
      ":::center",
      "# THE LAST BROADCAST",
      "",
      "Written by **Jane Doe** — :badge[Locked]{color=highlight}",
      ":::",
      "",
      "Standard left-aligned paragraph.",
      "",
      ":::right",
      "CUT TO:",
      ":::",
    ].join("\n")

    const parsed = manager.parse(alignedDoc)
    expect(parsed.content?.[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1, textAlign: "center" },
    })
    expect(parsed.content?.[1]).toMatchObject({
      type: "paragraph",
      attrs: { textAlign: "center" },
    })
    expect(parsed.content?.[2]).toMatchObject({
      type: "paragraph",
    })
    expect(parsed.content?.[3]).toMatchObject({
      type: "paragraph",
      attrs: { textAlign: "right" },
    })

    expect(manager.serialize(parsed)).toBe(alignedDoc)

    // Explicit textAlign: "left" must serialize as unwrapped plain Markdown
    const leftDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "left" },
          content: [{ type: "text", text: "Default left" }],
        },
      ],
    }
    expect(manager.serialize(leftDoc)).toBe("Default left")
  })

  it("round-trips a full plan document containing all 10 components without adding blank lines", () => {
    const fullDoc = [
      "# Project Plan: The Last Broadcast",
      SAMPLE_BADGE_PARAGRAPH,
      SAMPLE_PROPERTIES,
      SAMPLE_ATTRIBUTES,
      SAMPLE_TREE,
      SAMPLE_CARD,
      SAMPLE_PALETTE,
      SAMPLE_MOODBOARD,
      SAMPLE_TIMELINE,
      SAMPLE_MEDIA,
      SAMPLE_SOURCES,
    ].join("\n\n")

    const parsed = manager.parse(fullDoc)
    const serialized = manager.serialize(parsed)
    expect(serialized).toBe(fullDoc)
  })
})

describe("Diff hunk isolation & Pending-Change Reject/Merge with UI blocks", () => {
  const manager = createManager()

  it("isolates a single hex change in :::palette to a word-level hunk", () => {
    const nextPalette = SAMPLE_PALETTE.replace("#c4a574", "#d4b584")
    const hunks = getMarkdownChangeHunks(SAMPLE_PALETTE, nextPalette)

    expect(hunks).toEqual([
      expect.objectContaining({
        deleted: "c4a574",
        inserted: "d4b584",
      }),
    ])
  })

  it("isolates a duration or label edit in :::timeline to the changed token", () => {
    const nextTimeline = SAMPLE_TIMELINE.replace("12s", "15s")
    const hunks = getMarkdownChangeHunks(SAMPLE_TIMELINE, nextTimeline)

    expect(hunks).toEqual([
      expect.objectContaining({
        deleted: "12s",
        inserted: "15s",
      }),
    ])
  })

  it("isolates a shot description edit inside :::tree to the changed words", () => {
    const nextTree = SAMPLE_TREE.replace(
      "8s, slow cinematic dolly-in",
      "6s, handheld tracking shot",
    )
    const hunks = getMarkdownChangeHunks(SAMPLE_TREE, nextTree)

    expect(hunks).toHaveLength(1)
    expect(hunks[0]?.deleted).toContain("8s, slow cinematic dolly-in")
    expect(hunks[0]?.inserted).toContain("6s, handheld tracking shot")
  })

  it("isolates a body text edit inside :::card without touching card headers", () => {
    const nextCard = SAMPLE_CARD.replace("Sci-fi thriller", "Neo-noir mystery")
    const hunks = getMarkdownChangeHunks(SAMPLE_CARD, nextCard)

    expect(hunks).toEqual([
      expect.objectContaining({
        deleted: "Sci-fi thriller",
        inserted: "Neo-noir mystery",
      }),
    ])
  })

  it("isolates an inline :badge[] status change to a single hunk", () => {
    const before = "Status: :badge[Draft]{color=warning} for review"
    const after = "Status: :badge[Approved]{color=highlight} for review"
    const hunks = getMarkdownChangeHunks(before, after)

    expect(hunks).toHaveLength(1)
    expect(hunks[0]?.deleted).toContain("Draft")
    expect(hunks[0]?.inserted).toContain("Approved")
  })

  it("cleanly rejects an agent proposal while preserving unrelated manual edits across UI blocks", () => {
    const baseContent = [
      "# The Last Broadcast",
      SAMPLE_CARD,
      SAMPLE_PALETTE,
      SAMPLE_TIMELINE,
    ].join("\n\n")

    // Agent proposes adding a 5th beat to :::timeline
    const agentProposalRaw = baseContent.replace(
      "- 4s | Final reveal | scene-04",
      "- 4s | Final reveal | scene-04\n- 5s | Epilogue credits | scene-05",
    )

    // Editor loads agentProposalRaw and round-trips through Tiptap MarkdownManager
    const appliedProposal = manager.serialize(manager.parse(agentProposalRaw))
    expect(appliedProposal).toBe(agentProposalRaw)

    // User manually edits the card badge from "Concept" to "Locked" while the proposal is pending
    const userEditedDoc = manager.parse(
      appliedProposal.replace("badge: Concept", "badge: Locked"),
    )
    const current = manager.serialize(userEditedDoc)

    // User clicks Reject on the agent's pending changes
    const rejected = resolveRejectedMarkdown({
      baseContent,
      proposal: appliedProposal,
      current,
    })

    // Agent's timeline addition is reverted, while user's card badge edit is preserved
    expect(rejected).toContain("badge: Locked")
    expect(rejected).not.toContain("scene-05")
  })
})

describe("Tiptap Editor commands for UI blocks", () => {
  it("supports inserting all 10 UI components via editor commands", () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        EditorLink,
        ...uiBlockExtensions,
        Markdown.configure({ markedOptions: { gfm: true } }),
      ],
      content: "",
    })

    editor
      .chain()
      .insertMediaBlock({
        type: "video",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        alt: "Reference clip",
      })
      .insertPaletteBlock([{ color: "#112233", label: "Deep Blue" }])
      .insertTimelineBlock({
        title: "Act 1",
        items: [{ duration: "10s", label: "Intro", scene: "scene-01" }],
      })
      .insertPropertiesBlock({
        title: "Video Specifications",
        layout: "grid",
        items: [{ key: "Duration", value: "8s" }],
      })
      .insertAttributesBlock({
        title: "Creative Direction",
        items: [
          {
            label: "Visual Style",
            value: "1970s neo-noir cinematography.",
          },
        ],
      })
      .insertTreeBlock({
        items: [
          {
            label: "Production",
            description: "Main phase",
            depth: 0,
          },
          {
            label: "Scene 01",
            description: "Opening shot",
            depth: 1,
          },
        ],
      })
      .insertSourcesBlock([
        {
          title: "Ref",
          url: "https://example.com",
          description: "Notes",
        },
      ])
      .insertMoodboardBlock({
        title: "Board",
        columns: 3,
        items: [{ url: "https://example.com/a.jpg", caption: "Shot A" }],
      })
      .run()

    const md = editor.getMarkdown()
    expect(md).toContain(":::media")
    expect(md).toContain(":::palette")
    expect(md).toContain(":::timeline")
    expect(md).toContain(":::properties")
    expect(md).toContain(":::attributes")
    expect(md).toContain(":::tree")
    expect(md).toContain(":::sources")
    expect(md).toContain(":::moodboard")

    editor.destroy()
  })

  it("persists setTextAlign('center' | 'right' | 'left') via editor.getMarkdown()", () => {
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ link: false }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        EditorLink,
        ...uiBlockExtensions,
        Markdown.configure({ markedOptions: { gfm: true } }),
      ],
      content: "# Scene Title\n\nOpening shot.",
      contentType: "markdown",
    })

    editor.chain().selectAll().setTextAlign("center").run()
    expect(editor.getMarkdown()).toBe(
      ":::center\n# Scene Title\n\nOpening shot.\n:::",
    )

    editor.chain().selectAll().setTextAlign("right").run()
    expect(editor.getMarkdown()).toBe(
      ":::right\n# Scene Title\n\nOpening shot.\n:::",
    )

    editor.chain().selectAll().setTextAlign("left").run()
    expect(editor.getMarkdown()).toBe("# Scene Title\n\nOpening shot.")

    editor.destroy()
  })
})
