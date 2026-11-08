import { ReactNodeViewRenderer } from "@tiptap/react"
import {
  SceneAction,
  SceneEnvironment,
  SceneLighting,
  SceneTitle,
  Shot,
  ShotGrid,
  StoryboardDoc,
  StoryboardMeta,
  StoryboardScene,
} from "./storyboard-nodes"
import { SceneFieldNodeView } from "./scene-field-node-view"
import { SceneNodeView } from "./scene-node-view"
import { ShotGridNodeView } from "./shot-grid-node-view"
import { ShotNodeView } from "./shot-node-view"
import { StoryboardMetaNodeView } from "./storyboard-meta-node-view"

const StoryboardMetaWithView = StoryboardMeta.extend({
  addNodeView() {
    return ReactNodeViewRenderer(StoryboardMetaNodeView)
  },
})

const StoryboardSceneWithView = StoryboardScene.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SceneNodeView)
  },
})

const SceneEnvironmentWithView = SceneEnvironment.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SceneFieldNodeView)
  },
})

const SceneLightingWithView = SceneLighting.extend({
  addNodeView() {
    return ReactNodeViewRenderer(SceneFieldNodeView)
  },
})

const ShotGridWithView = ShotGrid.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ShotGridNodeView)
  },
})

const ShotWithView = Shot.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ShotNodeView)
  },
})

/** Full storyboard editor extension set (schema + markdown + node views). */
export const storyboardEditorExtensions = [
  StoryboardDoc,
  StoryboardMetaWithView,
  StoryboardSceneWithView,
  SceneTitle,
  SceneAction,
  SceneEnvironmentWithView,
  SceneLightingWithView,
  ShotGridWithView,
  ShotWithView,
]

export {
  StoryboardDoc,
  StoryboardMeta,
  StoryboardScene,
  SceneTitle,
  SceneAction,
  SceneEnvironment,
  SceneLighting,
  ShotGrid,
  Shot,
  sceneToNode,
  shotToNode,
  nodeToScene,
  nodeToShot,
  settingsToNode,
  nodeToSettings,
  storyboardSchemaExtensions,
} from "./storyboard-nodes"
export {
  DEFAULT_STORYBOARD_SETTINGS,
  STORYBOARD_ASPECT_RATIOS,
  STORYBOARD_SHOT_TYPES,
  aspectRatioToCss,
  aspectRatioToDimensions,
  ensureStoryboardFrontMatter,
  generateStoryboardId,
  parseAspectRatio,
  parseShotType,
  serializeFrontMatter,
} from "./storyboard-markdown"
export type {
  SceneData,
  ShotCamera,
  ShotData,
  ShotDialogueLine,
  StoryboardAspectRatio,
  StoryboardSettings,
  StoryboardShotType,
} from "./storyboard-markdown"
export {
  findSceneIdOfShot,
  getSceneSummaries,
  getShotData,
  getShotIds,
  getStoryboardSettings,
  insertSceneAfter,
  insertShot,
  moveScene,
  moveShot,
  updateShot,
  updateStoryboardSettings,
} from "./use-storyboard-dnd"
export type { SceneSummary } from "./use-storyboard-dnd"
export {
  collectSequenceShots,
  collectSequenceShotsFromJson,
  sceneAttachLabel,
  shotAttachLabel,
} from "./storyboard-sequence"
export type { SequenceShot } from "./storyboard-sequence"
export { StoryboardProvider, useStoryboardContext } from "./storyboard-context"
