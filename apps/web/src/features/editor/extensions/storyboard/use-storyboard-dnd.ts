import { arrayMove } from "@dnd-kit/sortable"
import {
  nodeToSettings,
  nodeToShot,
  sceneToNode,
  shotToNode,
} from "./storyboard-nodes"
import {
  DEFAULT_STORYBOARD_SETTINGS,
  generateStoryboardId,
} from "./storyboard-markdown"
import type { Editor, JSONContent } from "@tiptap/core"
import type { ShotData, StoryboardSettings } from "./storyboard-markdown"

export type SceneSummary = {
  id: string
  title: string
  firstImage: string
  shotCount: number
}

/**
 * `editor.getJSON()` returns a strict `DocumentType`; treat it as the loose
 * `JSONContent` shape our helpers operate on.
 */
function getDocJson(editor: Editor): JSONContent {
  return editor.getJSON()
}

function getSceneContent(scene: JSONContent): {
  title: JSONContent | undefined
  action: JSONContent | undefined
  grid: JSONContent | undefined
} {
  const children = scene.content ?? []
  return {
    title: children.find((child) => child.type === "sceneTitle"),
    action: children.find((child) => child.type === "sceneAction"),
    grid: children.find((child) => child.type === "shotGrid"),
  }
}

/** Snapshot of scenes for the preview panel, derived from the current doc. */
export function getSceneSummaries(editor: Editor | null): Array<SceneSummary> {
  if (!editor) return []
  const json = getDocJson(editor)
  return (json.content ?? [])
    .filter((node) => node.type === "storyboardScene")
    .map((scene) => {
      const { title, grid } = getSceneContent(scene)
      const shots = grid?.content ?? []
      const firstImage =
        shots.map((shot) => shot.attrs?.image).find((image) => !!image) ?? ""
      return {
        id: scene.attrs?.sceneId ?? "",
        title:
          title?.content
            ?.map((child) => (child.type === "text" ? (child.text ?? "") : ""))
            .join("") ?? "",
        firstImage,
        shotCount: shots.length,
      }
    })
}

function replaceDoc(editor: Editor, json: JSONContent) {
  editor.commands.setContent(json, { emitUpdate: true })
}

/** Flat list of every shot id in document order (for the shots SortableContext). */
export function getShotIds(editor: Editor | null): Array<string> {
  if (!editor) return []
  const ids: Array<string> = []
  for (const scene of getDocJson(editor).content ?? []) {
    const { grid } = getSceneContent(scene)
    for (const shot of grid?.content ?? []) {
      if (shot.attrs?.shotId) ids.push(shot.attrs.shotId as string)
    }
  }
  return ids
}

/** Read a single shot's structured data by id (used by the detail sheet). */
export function getShotData(editor: Editor, shotId: string): ShotData | null {
  const json = getDocJson(editor)
  for (const scene of json.content ?? []) {
    const { grid } = getSceneContent(scene)
    const shot = grid?.content?.find((s) => s.attrs?.shotId === shotId)
    if (shot) return nodeToShot(shot)
  }
  return null
}

/** Find the id of the scene that currently contains the given shot. */
export function findSceneIdOfShot(
  editor: Editor,
  shotId: string,
): string | null {
  const json = getDocJson(editor)
  for (const scene of json.content ?? []) {
    const { grid } = getSceneContent(scene)
    if (grid?.content?.some((shot) => shot.attrs?.shotId === shotId)) {
      return scene.attrs?.sceneId ?? null
    }
  }
  return null
}

/** Reorder top-level scenes so `fromId` takes the slot of `toId`. */
export function moveScene(
  editor: Editor,
  fromId: string,
  toId: string,
): boolean {
  if (fromId === toId) return false
  const json = getDocJson(editor)
  const scenes = json.content ?? []
  const fromIndex = scenes.findIndex((s) => s.attrs?.sceneId === fromId)
  const toIndex = scenes.findIndex((s) => s.attrs?.sceneId === toId)
  if (fromIndex < 0 || toIndex < 0) return false

  json.content = arrayMove(scenes, fromIndex, toIndex)
  replaceDoc(editor, json)
  return true
}

/**
 * Relocate a shot among scene JSON nodes. Same-scene drops use `arrayMove` so
 * dragging in either direction takes the target slot. Cross-scene drops insert
 * before `beforeShotId`, or append when it is omitted.
 */
export function relocateShots(
  scenes: Array<JSONContent>,
  shotId: string,
  toSceneId: string,
  beforeShotId?: string | null,
): boolean {
  let fromScene: JSONContent | undefined
  let fromIndex = -1
  let moved: JSONContent | undefined

  for (const scene of scenes) {
    const { grid } = getSceneContent(scene)
    if (!grid?.content) continue
    const index = grid.content.findIndex((s) => s.attrs?.shotId === shotId)
    if (index >= 0) {
      fromScene = scene
      fromIndex = index
      moved = grid.content[index]
      break
    }
  }
  if (!moved || !fromScene) return false

  const target = scenes.find((s) => s.attrs?.sceneId === toSceneId)
  if (!target) return false
  const { grid: targetGrid } = getSceneContent(target)
  if (!targetGrid) return false
  targetGrid.content = targetGrid.content ?? []

  const sameScene = fromScene === target
  if (sameScene && beforeShotId) {
    const toIndex = targetGrid.content.findIndex(
      (s) => s.attrs?.shotId === beforeShotId,
    )
    if (toIndex < 0 || toIndex === fromIndex) return false
    targetGrid.content = arrayMove(targetGrid.content, fromIndex, toIndex)
    return true
  }

  const { grid: sourceGrid } = getSceneContent(fromScene)
  sourceGrid?.content?.splice(fromIndex, 1)

  const insertAt = beforeShotId
    ? targetGrid.content.findIndex((s) => s.attrs?.shotId === beforeShotId)
    : -1

  if (insertAt >= 0) {
    targetGrid.content.splice(insertAt, 0, moved)
  } else {
    targetGrid.content.push(moved)
  }
  return true
}

/**
 * Move a shot to `toSceneId`. When `beforeShotId` is provided the shot takes
 * that shot's slot in the same scene, or is inserted before it in another
 * scene. Omitting `beforeShotId` appends. Works within and across scenes.
 */
export function moveShot(
  editor: Editor,
  shotId: string,
  toSceneId: string,
  beforeShotId?: string | null,
): boolean {
  const json = getDocJson(editor)
  const scenes = json.content ?? []
  if (!relocateShots(scenes, shotId, toSceneId, beforeShotId)) return false
  json.content = scenes
  replaceDoc(editor, json)
  return true
}

/** Insert a new empty scene directly after the scene with `sceneId`. */
export function insertSceneAfter(editor: Editor, sceneId: string): string {
  const json = getDocJson(editor)
  const scenes = json.content ?? []
  const index = scenes.findIndex((s) => s.attrs?.sceneId === sceneId)
  const newId = generateStoryboardId("scene")
  const newScene = sceneToNode({
    id: newId,
    title: "",
    action: "",
    environment: "",
    lighting: "",
    shots: [],
  })
  scenes.splice(index < 0 ? scenes.length : index + 1, 0, newScene)
  json.content = scenes
  replaceDoc(editor, json)
  return newId
}

/** Append a new empty shot to a scene and return its id. */
export function insertShot(editor: Editor, sceneId: string): string | null {
  const json = getDocJson(editor)
  const scene = (json.content ?? []).find((s) => s.attrs?.sceneId === sceneId)
  if (!scene) return null
  const { grid } = getSceneContent(scene)
  if (!grid) return null
  grid.content = grid.content ?? []

  const shotId = generateStoryboardId("shot")
  grid.content.push(shotToNode({ id: shotId, number: grid.content.length + 1 }))
  replaceDoc(editor, json)
  return shotId
}

/** Patch a shot's attributes in place (used by the detail sheet). */
export function updateShot(
  editor: Editor,
  shotId: string,
  patch: Omit<Partial<ShotData>, "shotType"> & { shotType?: string },
): boolean {
  const { state, view } = editor
  let pos = -1
  let currentAttrs: Record<string, unknown> = {}

  state.doc.descendants((node, nodePos) => {
    if (
      pos === -1 &&
      node.type.name === "shot" &&
      node.attrs.shotId === shotId
    ) {
      pos = nodePos
      currentAttrs = node.attrs
      return false
    }
    return true
  })

  if (pos === -1) return false

  const nextAttrs = {
    ...currentAttrs,
    ...(patch.number !== undefined ? { number: patch.number } : {}),
    ...(patch.shotType !== undefined ? { shotType: patch.shotType } : {}),
    ...(patch.image !== undefined ? { image: patch.image } : {}),
    ...(patch.action !== undefined ? { action: patch.action } : {}),
    ...(patch.composition !== undefined
      ? { composition: patch.composition }
      : {}),
    ...(patch.duration !== undefined ? { duration: patch.duration } : {}),
    ...(patch.purpose !== undefined ? { purpose: patch.purpose } : {}),
    ...(patch.transition !== undefined ? { transition: patch.transition } : {}),
    ...(patch.dialogue !== undefined ? { dialogue: patch.dialogue } : {}),
    ...(patch.narration !== undefined ? { narration: patch.narration } : {}),
    ...(patch.camera !== undefined
      ? {
          cameraAngle: patch.camera.angle ?? "",
          cameraMovement: patch.camera.movement ?? "",
        }
      : {}),
  }

  view.dispatch(state.tr.setNodeMarkup(pos, undefined, nextAttrs))
  return true
}

/** Read the document-level world bible, or the defaults when it is missing. */
export function getStoryboardSettings(
  editor: Editor | null,
): StoryboardSettings {
  if (!editor) return { ...DEFAULT_STORYBOARD_SETTINGS }
  const meta = (getDocJson(editor).content ?? []).find(
    (node) => node.type === "storyboardMeta",
  )
  return meta ? nodeToSettings(meta) : { ...DEFAULT_STORYBOARD_SETTINGS }
}

/** Replace the world-bible attributes on the hidden meta node. */
export function updateStoryboardSettings(
  editor: Editor,
  settings: StoryboardSettings,
): boolean {
  const { state, view } = editor
  let pos = -1

  state.doc.descendants((node, nodePos) => {
    if (pos === -1 && node.type.name === "storyboardMeta") {
      pos = nodePos
      return false
    }
    return true
  })

  if (pos === -1) return false

  view.dispatch(
    state.tr.setNodeMarkup(pos, undefined, {
      aspectRatio: settings.aspectRatio,
      visualStyle: settings.visualStyle,
      colorPalette: settings.colorPalette,
      temporalContext: settings.temporalContext,
    }),
  )
  return true
}
