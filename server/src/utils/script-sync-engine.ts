import type { Scene } from "@/db/schema";
import type { ProseDocument, ProseNode, SceneContent } from "@/type";

const UNKNOWN_CHARACTER_VALUE = "unknown";
const UNKNOWN_SCENE_PREFIX = "unknown-scene";

export type SceneLike = Pick<Scene, "id" | "content"> & Partial<Omit<Scene, "id" | "content">>;

type ProseInlineNode = {
  type?: string;
  text?: string;
  content?: ProseNode["content"];
};

export type DiffResult = {
  delete: string[];
  update: Array<{
    id: string;
    index: number;
    scene: SceneLike;
  }>;
  insert: Array<{
    index: number;
    scene: SceneLike;
  }>;
};

// Recursively flatten a prose node into plain text, preserving hard breaks.
function extractNodeText(node: ProseNode | ProseInlineNode | undefined): string {
  if (!node) {
    return "";
  }

  if (typeof node.text === "string") {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return node.type === "hardBreak" ? "\n" : "";
  }

  return node.content
    .map((child) => extractNodeText(child as ProseNode | ProseInlineNode))
    .join("");
}

// Normalize unknown text-like values into an empty string.
function normalizeText(text: string | undefined): string {
  return typeof text === "string" ? text : "";
}

// Build a deterministic fallback scene id from the current scene index.
function makeUnknownSceneId(index: number): string {
  return `${UNKNOWN_SCENE_PREFIX}-${index + 1}`;
}

// Reuse the incoming scene id when possible, otherwise synthesize a unique fallback id.
function getSceneId(rawId: unknown, index: number, usedIds: Set<string>): string {
  const preferredId = typeof rawId === "string" && rawId.trim().length > 0
    ? rawId.trim()
    : makeUnknownSceneId(index);

  if (!usedIds.has(preferredId)) {
    usedIds.add(preferredId);
    return preferredId;
  }

  let suffix = 2;
  let nextId = `${preferredId}-${suffix}`;
  while (usedIds.has(nextId)) {
    suffix += 1;
    nextId = `${preferredId}-${suffix}`;
  }

  usedIds.add(nextId);
  return nextId;
}

// Normalize one stored scene block while enforcing required placeholder values.
function normalizeSceneBlock(block: SceneContent): SceneContent {
  switch (block.type) {
    case "slugline":
      return {
        type: "slugline",
        text: normalizeText(block.text),
        ...(block.locationId ? { locationId: block.locationId } : {}),
      };
    case "action":
      return {
        type: "action",
        text: normalizeText(block.text),
      };
    case "transition":
      return {
        type: "transition",
        text: normalizeText(block.text),
      };
    case "dialogue":
      return {
        type: "dialogue",
        character: normalizeText(block.character) || UNKNOWN_CHARACTER_VALUE,
        text: normalizeText(block.text),
        ...(block.parenthetical !== undefined
          ? { parenthetical: normalizeText(block.parenthetical) }
          : {}),
      };
  }
}

// Normalize a scene content array so comparisons and conversions stay deterministic.
function normalizeSceneContent(content: SceneContent[] | undefined): SceneContent[] {
  if (!Array.isArray(content)) {
    return [];
  }

  return content.map(normalizeSceneBlock);
}

// Normalize a scene-like object and guarantee it has an id and normalized content.
function normalizeSceneLike(scene: SceneLike, index: number): SceneLike {
  return {
    ...scene,
    id: typeof scene.id === "string" && scene.id.trim().length > 0
      ? scene.id.trim()
      : makeUnknownSceneId(index),
    content: normalizeSceneContent(scene.content),
  };
}

// Normalize a list of scenes and de-duplicate ids so later diff logic can key by id safely.
function prepareScenes<T extends SceneLike>(scenes: T[]): SceneLike[] {
  const usedIds = new Set<string>();

  return scenes.map((scene, index) => {
    const normalized = normalizeSceneLike(scene, index);
    return {
      ...normalized,
      id: getSceneId(normalized.id, index, usedIds),
    };
  });
}

// Collapse a nested dialogue prose node into the stored flat dialogue shape.
function parseDialogueBlock(dialogueNode: ProseNode): SceneContent {
  const children = Array.isArray(dialogueNode.content)
    ? dialogueNode.content.filter((child): child is ProseNode => child.type !== "text")
    : [];
  const characterNode = children.find((child) => child.type === "character");
  const parentheticalNode = children.find((child) => child.type === "parenthetical");
  const speechNode = children.find((child) => child.type === "speech");

  return {
    type: "dialogue",
    character: normalizeText(extractNodeText(characterNode)) || UNKNOWN_CHARACTER_VALUE,
    text: normalizeText(extractNodeText(speechNode)),
    ...(parentheticalNode
      ? { parenthetical: normalizeText(extractNodeText(parentheticalNode)) }
      : {}),
  };
}

// Parse one prose scene into stored scene blocks while preserving the original block order.
function parseSceneContent(nodes: ProseNode[] | undefined): SceneContent[] {
  if (!Array.isArray(nodes)) {
    return [];
  }

  const content: SceneContent[] = [];

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const text = normalizeText(extractNodeText(node));

    switch (node.type) {
      case "slugline":
        content.push({ type: "slugline", text });
        break;
      case "action":
        content.push({ type: "action", text });
        break;
      case "transition":
        content.push({ type: "transition", text });
        break;
      case "shot":
      case "note":
        break;
      case "dialogue":
        content.push(parseDialogueBlock(node));
        break;
      default:
        break;
    }
  }

  return normalizeSceneContent(content);
}

// Compare normalized scene block arrays so diffs are based on persisted semantics.
function compareSceneContent(left: SceneContent[], right: SceneContent[]): boolean {
  return JSON.stringify(normalizeSceneContent(left)) === JSON.stringify(normalizeSceneContent(right));
}

// Build a plain text ProseMirror text node.
function buildProseTextNode(text: string): ProseNode {
  return {
    type: "text",
    text,
  };
}

// Build a prose block node with a single text child.
function buildBlockNode(type: string, text: string, attrs?: Record<string, unknown>): ProseNode {
  return {
    type,
    ...(attrs && Object.keys(attrs).length > 0 ? { attrs } : {}),
    content: [buildProseTextNode(text)],
  };
}

function buildDialogueNode(
  character: string,
  text: string,
  parenthetical?: string,
): ProseNode {
  return {
    type: "dialogue",
    content: [
      buildBlockNode("character", character),
      ...(parenthetical !== undefined
        ? [buildBlockNode("parenthetical", parenthetical)]
        : []),
      buildBlockNode("speech", text),
    ],
  };
}

// The editor schema requires each scene to start with a slugline, so synthesize an empty one if needed.
function ensureSceneStartsWithSlugline(content: SceneContent[]): SceneContent[] {
  if (content.length === 0 || content[0]?.type !== "slugline") {
    return [{ type: "slugline", text: "" }, ...content];
  }

  return content;
}

// Convert a full TipTap script document into ordered scene rows for persistence and diffing.
export function parseScenesFromProse(doc: ProseDocument): SceneLike[] {
  if (doc.type !== "doc" || !Array.isArray(doc.content)) {
    return [];
  }

  const usedIds = new Set<string>();

  return doc.content
    .filter((node): node is ProseNode => node?.type === "scene")
    .map((sceneNode, index) => ({
      id: getSceneId(sceneNode.attrs?.id, index, usedIds),
      content: parseSceneContent(sceneNode.content),
    }));
}

// Produce the operations needed to transform one ordered scene list into another.
export function diffScenes(oldScenes: SceneLike[], newScenes: SceneLike[]): DiffResult {
  const currentScenes = prepareScenes(oldScenes);
  const nextScenes = prepareScenes(newScenes);

  const oldById = new Map(currentScenes.map((scene) => [scene.id, scene]));
  const nextIds = new Set(nextScenes.map((scene) => scene.id));

  const diff: DiffResult = {
    delete: currentScenes
      .filter((scene) => !nextIds.has(scene.id))
      .map((scene) => scene.id),
    update: [],
    insert: [],
  };

  nextScenes.forEach((scene, index) => {
    const existingScene = oldById.get(scene.id);

    if (!existingScene) {
      diff.insert.push({
        index,
        scene,
      });
      return;
    }

    if (
      !compareSceneContent(existingScene.content, scene.content)
      || currentScenes.findIndex((currentScene) => currentScene.id === scene.id) !== index
    ) {
      diff.update.push({
        id: scene.id,
        index,
        scene: {
          ...existingScene,
          ...scene,
          id: scene.id,
          content: normalizeSceneContent(scene.content),
        },
      });
      return;
    }

    diff.update.push({
      id: scene.id,
      index,
      scene: existingScene,
    });
  });

  return diff;
}

// Apply a scene diff into a new ordered scene list without mutating the original input.
export function applyDiffToScenes(scenes: SceneLike[], diff: DiffResult): SceneLike[] {
  const deletedIds = new Set(diff.delete);
  const baseScenes = prepareScenes(scenes).filter((scene) => !deletedIds.has(scene.id));
  const baseById = new Map(baseScenes.map((scene) => [scene.id, scene]));

  const placedScenes = [
    ...diff.update.map((operation) => ({
      index: operation.index,
      scene: {
        ...(baseById.get(operation.id) ?? {}),
        ...normalizeSceneLike(operation.scene, operation.index),
        id: operation.id,
      } as SceneLike,
    })),
    ...diff.insert.map((operation) => ({
      index: operation.index,
      scene: normalizeSceneLike(operation.scene, operation.index),
    })),
  ].sort((left, right) => left.index - right.index);

  return placedScenes.map(({ scene }) => scene);
}

// Rebuild prose by applying the diff at the scene level and converting the result back to TipTap JSON.
export function applyDiffToProse(doc: ProseDocument, diff: DiffResult): ProseDocument {
  const parsedScenes = parseScenesFromProse(doc);
  const nextScenes = applyDiffToScenes(parsedScenes, diff);
  return convertScenesToProse(nextScenes);
}

// Convert persisted scene rows back into the TipTap scene/sceneDelimiter structure expected by the editor.
export function convertScenesToProse(scenes: SceneLike[]): ProseDocument {
  const normalizedScenes = prepareScenes(scenes);
  const content: ProseNode[] = [];

  normalizedScenes.forEach((scene, index) => {
    if (index > 0) {
      content.push({ type: "sceneDelimiter" });
    }

    const sceneContent = ensureSceneStartsWithSlugline(normalizeSceneContent(scene.content));
    const proseSceneContent: ProseNode[] = [];

    sceneContent.forEach((block) => {
      switch (block.type) {
        case "slugline":
          proseSceneContent.push(buildBlockNode("slugline", block.text));
          break;
        case "action":
          proseSceneContent.push(buildBlockNode("action", block.text));
          break;
        case "transition":
          proseSceneContent.push(buildBlockNode("transition", block.text));
          break;
        case "dialogue":
          proseSceneContent.push(
            buildDialogueNode(block.character, block.text, block.parenthetical),
          );
          break;
      }
    });

    content.push({
      type: "scene",
      attrs: {
        id: scene.id,
        sceneNumber: index + 1,
      },
      content: proseSceneContent,
    });
  });

  return {
    type: "doc",
    content,
  };
}