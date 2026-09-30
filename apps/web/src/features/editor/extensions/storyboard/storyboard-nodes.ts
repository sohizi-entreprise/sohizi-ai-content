import { Node, mergeAttributes } from "@tiptap/core"
import {
  DEFAULT_STORYBOARD_SETTINGS,
  generateStoryboardId,
  matchFrontMatterBlock,
  matchSceneBlock,
  parseAspectRatio,
  parseFrontMatter,
  parseSceneBlock,
  serializeFrontMatter,
  serializeScene,
} from "./storyboard-markdown"
import type {
  SceneData,
  ShotData,
  ShotDialogueLine,
  StoryboardSettings,
} from "./storyboard-markdown"
import type { JSONContent } from "@tiptap/core"

/**
 * Restrictive top node: world bible, then a non-empty list of scenes.
 */
export const StoryboardDoc = Node.create({
  name: "doc",
  topNode: true,
  content: "storyboardMeta storyboardScene+",

  renderMarkdown: (node, helpers) => {
    return helpers.renderChildren(node.content ?? [], "\n").trimEnd() + "\n"
  },
})

export const StoryboardMeta = Node.create({
  name: "storyboardMeta",
  atom: true,
  selectable: false,
  draggable: false,

  addAttributes() {
    return {
      aspectRatio: {
        default: DEFAULT_STORYBOARD_SETTINGS.aspectRatio,
        parseHTML: (el) =>
          parseAspectRatio(el.getAttribute("data-aspect-ratio") ?? ""),
        renderHTML: (attrs) => ({
          "data-aspect-ratio": parseAspectRatio(
            String(attrs.aspectRatio ?? ""),
          ),
        }),
      },
      visualStyle: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-visual-style") ?? "",
        renderHTML: (attrs) =>
          attrs.visualStyle ? { "data-visual-style": attrs.visualStyle } : {},
      },
      colorPalette: {
        default: [],
        parseHTML: (el) =>
          parseColorPaletteAttribute(el.getAttribute("data-color-palette")),
        renderHTML: (attrs) => {
          const palette = normalizeColorPalette(attrs.colorPalette)
          return palette.length > 0
            ? { "data-color-palette": JSON.stringify(palette) }
            : {}
        },
      },
      temporalContext: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-temporal-context") ?? "",
        renderHTML: (attrs) =>
          attrs.temporalContext
            ? { "data-temporal-context": attrs.temporalContext }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="storyboard-meta"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "storyboard-meta",
        hidden: "",
      }),
    ]
  },

  markdownTokenizer: {
    name: "storyboardMeta",
    level: "block",
    start: (src: string) => src.search(/^---[ \t]*$/m),
    tokenize: (src: string) => {
      const raw = matchFrontMatterBlock(src)
      if (!raw) return undefined
      return {
        type: "storyboardMeta",
        raw,
        settings: parseFrontMatter(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const settings = token.settings ?? parseFrontMatter(token.raw ?? "")
    return settingsToNode(settings)
  },

  renderMarkdown: (node) => {
    return `${serializeFrontMatter(nodeToSettings(node))}\n`
  },
})

export const SceneTitle = Node.create({
  name: "sceneTitle",
  content: "inline*",
  marks: "",

  parseHTML() {
    return [{ tag: 'div[data-type="scene-title"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "scene-title" }),
      0,
    ]
  },
})

export const SceneAction = Node.create({
  name: "sceneAction",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'div[data-type="scene-action"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "scene-action" }),
      0,
    ]
  },
})

export const SceneEnvironment = Node.create({
  name: "sceneEnvironment",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'div[data-type="scene-environment"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "scene-environment" }),
      0,
    ]
  },
})

export const SceneLighting = Node.create({
  name: "sceneLighting",
  content: "inline*",

  parseHTML() {
    return [{ tag: 'div[data-type="scene-lighting"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "scene-lighting" }),
      0,
    ]
  },
})

export const ShotGrid = Node.create({
  name: "shotGrid",
  group: "block",
  content: "shot*",

  parseHTML() {
    return [{ tag: 'div[data-type="shot-grid"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "shot-grid" }),
      0,
    ]
  },
})

export const Shot = Node.create({
  name: "shot",
  group: "shotItem",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      shotId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-shot-id"),
        renderHTML: (attrs) =>
          attrs.shotId ? { "data-shot-id": attrs.shotId } : {},
      },
      number: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-number")
          if (raw == null) return null
          const parsed = Number(raw)
          return Number.isNaN(parsed) ? null : parsed
        },
        renderHTML: (attrs) =>
          attrs.number != null ? { "data-number": String(attrs.number) } : {},
      },
      image: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-image") ?? "",
        renderHTML: (attrs) =>
          attrs.image ? { "data-image": attrs.image } : {},
      },
      action: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-action") ?? "",
        renderHTML: (attrs) =>
          attrs.action ? { "data-action": attrs.action } : {},
      },
      dialogue: {
        default: [],
        parseHTML: (el) =>
          parseDialogueAttribute(el.getAttribute("data-dialogue")),
        renderHTML: (attrs) => {
          const dialogue = normalizeDialogue(attrs.dialogue)
          return dialogue.length > 0
            ? { "data-dialogue": JSON.stringify(dialogue) }
            : {}
        },
      },
      narration: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-narration") ?? "",
        renderHTML: (attrs) =>
          attrs.narration ? { "data-narration": attrs.narration } : {},
      },
      cameraAngle: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-camera-angle") ?? "",
        renderHTML: (attrs) =>
          attrs.cameraAngle ? { "data-camera-angle": attrs.cameraAngle } : {},
      },
      cameraMovement: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-camera-movement") ?? "",
        renderHTML: (attrs) =>
          attrs.cameraMovement
            ? { "data-camera-movement": attrs.cameraMovement }
            : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="shot"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "shot" })]
  },
})

export const StoryboardScene = Node.create({
  name: "storyboardScene",
  group: "block",
  content: "sceneTitle sceneAction sceneEnvironment sceneLighting shotGrid",
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      sceneId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-scene-id"),
        renderHTML: (attrs) =>
          attrs.sceneId ? { "data-scene-id": attrs.sceneId } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'section[data-type="storyboard-scene"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      mergeAttributes(HTMLAttributes, { "data-type": "storyboard-scene" }),
      0,
    ]
  },

  markdownTokenizer: {
    name: "storyboardScene",
    level: "block",
    start: (src: string) => src.indexOf(":::scene"),
    tokenize: (src: string) => {
      const raw = matchSceneBlock(src)
      if (!raw) return undefined
      return {
        type: "storyboardScene",
        raw,
        scene: parseSceneBlock(raw),
      }
    },
  },

  parseMarkdown: (token) => {
    const scene = token.scene ?? parseSceneBlock(token.raw ?? "")
    return sceneToNode(scene)
  },

  renderMarkdown: (node) => {
    return `${serializeScene(nodeToScene(node))}\n`
  },
})

// ---- JSON <-> data conversion --------------------------------------------

export function settingsToNode(settings: StoryboardSettings): JSONContent {
  return {
    type: "storyboardMeta",
    attrs: {
      aspectRatio: parseAspectRatio(settings.aspectRatio),
      visualStyle: settings.visualStyle ?? "",
      colorPalette: normalizeColorPalette(settings.colorPalette),
      temporalContext: settings.temporalContext ?? "",
    },
  }
}

export function nodeToSettings(node: JSONContent): StoryboardSettings {
  const attrs = node.attrs ?? {}
  return {
    aspectRatio: parseAspectRatio(String(attrs.aspectRatio ?? "")),
    visualStyle: typeof attrs.visualStyle === "string" ? attrs.visualStyle : "",
    colorPalette: normalizeColorPalette(attrs.colorPalette),
    temporalContext:
      typeof attrs.temporalContext === "string" ? attrs.temporalContext : "",
  }
}

export function sceneToNode(scene: SceneData): JSONContent {
  return {
    type: "storyboardScene",
    attrs: { sceneId: scene.id || generateStoryboardId("scene") },
    content: [
      {
        type: "sceneTitle",
        content: textContent(scene.title),
      },
      {
        type: "sceneAction",
        content: textContent(scene.description),
      },
      {
        type: "sceneEnvironment",
        content: textContent(scene.environment),
      },
      {
        type: "sceneLighting",
        content: textContent(scene.lighting),
      },
      {
        type: "shotGrid",
        content: scene.shots.map(shotToNode),
      },
    ],
  }
}

export function shotToNode(shot: ShotData): JSONContent {
  return {
    type: "shot",
    attrs: {
      shotId: shot.id || generateStoryboardId("shot"),
      number: shot.number ?? null,
      image: shot.image ?? "",
      action: shot.action ?? "",
      dialogue: normalizeDialogue(shot.dialogue),
      narration: shot.narration ?? "",
      cameraAngle: shot.camera?.angle ?? "",
      cameraMovement: shot.camera?.movement ?? "",
    },
  }
}

export function nodeToScene(node: JSONContent): SceneData {
  const children = node.content ?? []
  const titleNode = children.find((child) => child.type === "sceneTitle")
  const actionNode = children.find((child) => child.type === "sceneAction")
  const environmentNode = children.find(
    (child) => child.type === "sceneEnvironment",
  )
  const lightingNode = children.find((child) => child.type === "sceneLighting")
  const gridNode = children.find((child) => child.type === "shotGrid")

  return {
    id: node.attrs?.sceneId ?? generateStoryboardId("scene"),
    title: getNodeText(titleNode),
    description: getNodeText(actionNode),
    environment: getNodeText(environmentNode),
    lighting: getNodeText(lightingNode),
    shots: (gridNode?.content ?? []).map(nodeToShot),
  }
}

export function nodeToShot(node: JSONContent): ShotData {
  const attrs = node.attrs ?? {}
  const dialogue = normalizeDialogue(attrs.dialogue)
  const shot: ShotData = {
    id: attrs.shotId ?? generateStoryboardId("shot"),
  }
  if (attrs.number != null) shot.number = attrs.number
  if (attrs.image) shot.image = attrs.image
  if (attrs.action) shot.action = attrs.action
  if (dialogue.length > 0) shot.dialogue = dialogue
  if (attrs.narration) shot.narration = attrs.narration
  const cameraAngle =
    typeof attrs.cameraAngle === "string" ? attrs.cameraAngle : ""
  const cameraMovement =
    typeof attrs.cameraMovement === "string" ? attrs.cameraMovement : ""
  if (cameraAngle || cameraMovement) {
    shot.camera = {}
    if (cameraAngle) shot.camera.angle = cameraAngle
    if (cameraMovement) shot.camera.movement = cameraMovement
  }
  return shot
}

function textContent(value: string): Array<JSONContent> {
  return value ? [{ type: "text", text: value }] : []
}

function getNodeText(node: JSONContent | undefined): string {
  if (!node?.content) return ""
  return node.content
    .map((child) => (child.type === "text" ? (child.text ?? "") : ""))
    .join("")
}

function normalizeDialogue(value: unknown): Array<ShotDialogueLine> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null
      const record = entry as Record<string, unknown>
      return {
        speaker: typeof record.speaker === "string" ? record.speaker : "",
        text: typeof record.text === "string" ? record.text : "",
      }
    })
    .filter((entry): entry is ShotDialogueLine => entry !== null)
}

function parseDialogueAttribute(value: string | null): Array<ShotDialogueLine> {
  if (!value) return []
  try {
    return normalizeDialogue(JSON.parse(value))
  } catch {
    return []
  }
}

function normalizeColorPalette(value: unknown): Array<string> {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

function parseColorPaletteAttribute(value: string | null): Array<string> {
  if (!value) return []
  try {
    return normalizeColorPalette(JSON.parse(value))
  } catch {
    return []
  }
}

/** Pure schema + markdown extensions (no React node views). */
export const storyboardSchemaExtensions = [
  StoryboardDoc,
  StoryboardMeta,
  StoryboardScene,
  SceneTitle,
  SceneAction,
  SceneEnvironment,
  SceneLighting,
  ShotGrid,
  Shot,
]
