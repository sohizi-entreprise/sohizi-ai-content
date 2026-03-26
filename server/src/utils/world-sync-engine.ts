import type { ProseDocument, ProseNode } from "@/type";
import type { StoryBible } from "zSchemas";

type StoryBibleFieldKey =
  | "world.setting"
  | "world.timePeriod"
  | "world.worldRules"
  | "world.socialContext"
  | "conflictEngine.centralConflict"
  | "conflictEngine.stakes"
  | "conflictEngine.antagonisticForce"
  | "conflictEngine.timePressure"
  | "conflictEngine.mainDramaticQuestion"
  | "toneAndStyle.visualStyle"
  | "toneAndStyle.dialogueStyle"
  | "toneAndStyle.pacing"
  | "continuityRules.factsToConsistent"
  | "continuityRules.characterBehaviorRules"
  | "continuityRules.thingsToAvoid";

type StoryBibleFieldConfig = {
  section: string;
  key: StoryBibleFieldKey;
  nodeType: string;
  label: string;
  placeholder: string;
};

const STORY_BIBLE_FIELDS: readonly StoryBibleFieldConfig[] = [
  { section: "World", key: "world.setting", nodeType: "setting", label: "Setting", placeholder: "Enter setting..." },
  { section: "World", key: "world.timePeriod", nodeType: "timePeriod", label: "Time period", placeholder: "Enter time period..." },
  { section: "World", key: "world.worldRules", nodeType: "worldRules", label: "World rules", placeholder: "Enter world rules..." },
  { section: "World", key: "world.socialContext", nodeType: "socialContext", label: "Social context", placeholder: "Enter social context..." },
  { section: "Conflict", key: "conflictEngine.centralConflict", nodeType: "centralConflict", label: "Central conflict", placeholder: "Enter central conflict..." },
  { section: "Conflict", key: "conflictEngine.stakes", nodeType: "stakes", label: "Stakes", placeholder: "Enter stakes..." },
  { section: "Conflict", key: "conflictEngine.antagonisticForce", nodeType: "antagonisticForce", label: "Antagonistic force", placeholder: "Enter antagonistic force..." },
  { section: "Conflict", key: "conflictEngine.timePressure", nodeType: "timePressure", label: "Time pressure", placeholder: "Enter time pressure..." },
  { section: "Conflict", key: "conflictEngine.mainDramaticQuestion", nodeType: "mainDramaticQuestion", label: "Main dramatic question", placeholder: "Enter main dramatic question..." },
  { section: "Tone & style", key: "toneAndStyle.visualStyle", nodeType: "visualStyle", label: "Visual style", placeholder: "Enter visual style..." },
  { section: "Tone & style", key: "toneAndStyle.dialogueStyle", nodeType: "dialogueStyle", label: "Dialogue style", placeholder: "Enter dialogue style..." },
  { section: "Tone & style", key: "toneAndStyle.pacing", nodeType: "pacing", label: "Pacing", placeholder: "Enter pacing..." },
  { section: "Continuity", key: "continuityRules.factsToConsistent", nodeType: "factsToConsistent", label: "Facts to keep consistent", placeholder: "Enter facts to keep consistent..." },
  { section: "Continuity", key: "continuityRules.characterBehaviorRules", nodeType: "characterBehaviorRules", label: "Character behavior rules", placeholder: "Enter character behavior rules..." },
  { section: "Continuity", key: "continuityRules.thingsToAvoid", nodeType: "thingsToAvoid", label: "Things to avoid", placeholder: "Enter things to avoid..." },
] as const;

const SECTION_ORDER = [...new Set(STORY_BIBLE_FIELDS.map((field) => field.section))];

const FIELD_BY_NODE_TYPE = STORY_BIBLE_FIELDS.reduce<Record<string, StoryBibleFieldConfig>>((acc, field) => {
  acc[field.nodeType] = field;
  return acc;
}, {});

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toInlineContent(value: string): ProseNode[] | undefined {
  if (!value) {
    return undefined;
  }

  const content: ProseNode[] = [];
  const lines = value.split("\n");

  lines.forEach((line, index) => {
    if (line) {
      content.push({ type: "text", text: line });
    }
    if (index < lines.length - 1) {
      content.push({ type: "hardBreak" });
    }
  });

  return content.length > 0 ? content : undefined;
}

function extractTextFromNode(node: ProseNode | undefined): string {
  if (!node) {
    return "";
  }

  if (typeof node.text === "string") {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return node.type === "hardBreak" ? "\n" : "";
  }

  return node.content.map((child) => extractTextFromNode(child as ProseNode)).join("");
}

function buildFieldNode(field: StoryBibleFieldConfig, value: string): ProseNode {
  return {
    type: field.nodeType,
    attrs: {
      label: field.label,
      placeholder: field.placeholder,
    },
    content: toInlineContent(value),
  };
}

function getFieldValue(storyBible: StoryBible, key: StoryBibleFieldKey): string {
  const [section, field] = key.split(".");
  const sectionData = storyBible[section as keyof StoryBible] as Record<string, unknown> | undefined;
  return normalizeText(sectionData?.[field]);
}

function setFieldValue(storyBible: StoryBible, key: StoryBibleFieldKey, value: string): StoryBible {
  const [section, field] = key.split(".");

  if (section === "world") {
    return {
      ...storyBible,
      world: {
        ...storyBible.world,
        [field]: value,
      },
    };
  }

  if (section === "conflictEngine") {
    return {
      ...storyBible,
      conflictEngine: {
        ...storyBible.conflictEngine,
        [field]: value,
      },
    };
  }

  if (section === "toneAndStyle") {
    return {
      ...storyBible,
      toneAndStyle: {
        ...storyBible.toneAndStyle,
        [field]: value,
      },
    };
  }

  return {
    ...storyBible,
    continuityRules: {
      ...storyBible.continuityRules,
      [field]: value,
    },
  };
}

function createEmptyStoryBible(): StoryBible {
  return {
    world: {
      setting: "",
      timePeriod: "",
      worldRules: "",
      socialContext: "",
    },
    conflictEngine: {
      centralConflict: "",
      stakes: "",
      antagonisticForce: "",
      timePressure: "",
      mainDramaticQuestion: "",
    },
    keyLocations: [],
    keyCharacters: [],
    toneAndStyle: {
      visualStyle: "",
      dialogueStyle: "",
      pacing: "",
    },
    continuityRules: {
      factsToConsistent: "",
      characterBehaviorRules: "",
      thingsToAvoid: "",
    },
  };
}

function normalizeStoryBible(storyBible?: StoryBible | null): StoryBible {
  if (!storyBible) {
    return createEmptyStoryBible();
  }

  return {
    world: {
      setting: normalizeText(storyBible.world?.setting),
      timePeriod: normalizeText(storyBible.world?.timePeriod),
      worldRules: normalizeText(storyBible.world?.worldRules),
      socialContext: normalizeText(storyBible.world?.socialContext),
    },
    conflictEngine: {
      centralConflict: normalizeText(storyBible.conflictEngine?.centralConflict),
      stakes: normalizeText(storyBible.conflictEngine?.stakes),
      antagonisticForce: normalizeText(storyBible.conflictEngine?.antagonisticForce),
      timePressure: normalizeText(storyBible.conflictEngine?.timePressure),
      mainDramaticQuestion: normalizeText(storyBible.conflictEngine?.mainDramaticQuestion),
    },
    keyLocations: Array.isArray(storyBible.keyLocations) ? storyBible.keyLocations : [],
    keyCharacters: Array.isArray(storyBible.keyCharacters) ? storyBible.keyCharacters : [],
    toneAndStyle: {
      visualStyle: normalizeText(storyBible.toneAndStyle?.visualStyle),
      dialogueStyle: normalizeText(storyBible.toneAndStyle?.dialogueStyle),
      pacing: normalizeText(storyBible.toneAndStyle?.pacing),
    },
    continuityRules: {
      factsToConsistent: normalizeText(storyBible.continuityRules?.factsToConsistent),
      characterBehaviorRules: normalizeText(storyBible.continuityRules?.characterBehaviorRules),
      thingsToAvoid: normalizeText(storyBible.continuityRules?.thingsToAvoid),
    },
  };
}

export function storyBibleToProseDoc(storyBible?: StoryBible | null): ProseDocument {
  const normalizedStoryBible = normalizeStoryBible(storyBible);
  const content: ProseNode[] = [];

  for (const section of SECTION_ORDER) {
    content.push({
      type: "worldSectionHeading",
      attrs: { title: section },
    });

    for (const field of STORY_BIBLE_FIELDS.filter((item) => item.section === section)) {
      content.push(buildFieldNode(field, getFieldValue(normalizedStoryBible, field.key)));
    }
  }

  return { type: "doc", content };
}

export function proseDocToStoryBible(existingStoryBible: StoryBible | null | undefined, doc: ProseDocument): StoryBible {
  let nextStoryBible = normalizeStoryBible(existingStoryBible);

  for (const node of doc.content ?? []) {
    const field = FIELD_BY_NODE_TYPE[node.type];
    if (!field) {
      continue;
    }

    nextStoryBible = setFieldValue(nextStoryBible, field.key, extractTextFromNode(node));
  }

  return nextStoryBible;
}