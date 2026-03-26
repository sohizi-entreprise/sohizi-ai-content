import type { Entity } from "@/db/schema";
import { getSlug } from "@/features/ai/utils";
import type { ProseDocument, ProseNode } from "@/type";
import type { Character, EntityObject, Location, Prop } from "zSchemas";

type SupportedEntityType = "CHARACTER" | "LOCATION" | "PROP";

type FieldConfig = {
  key: string;
  nodeType: string;
  label: string;
  placeholder: string;
};

type EntitySyncPayload = Pick<Entity, "id" | "projectId" | "type"> & {
  name: string;
  slug: string;
  metadata: EntityObject;
  prose: ProseDocument;
};

const CHARACTER_FIELDS = [
  { key: "physicalDescription", nodeType: "physicalDescription", label: "PHYSICAL PROFILE", placeholder: "Describe physical appearance..." },
  { key: "personalityTraits", nodeType: "personalityTraits", label: "CORE TRAITS", placeholder: "Traits separated by commas (e.g., Determined, Secretive, Analytical)..." },
  { key: "backstory", nodeType: "backstory", label: "BACKSTORY", placeholder: "Character's relevant history..." },
  { key: "motivation", nodeType: "motivation", label: "MOTIVATION", placeholder: "What drives this character..." },
  { key: "flaw", nodeType: "flaw", label: "FATAL FLAW", placeholder: "Character's key weakness..." },
  { key: "voice", nodeType: "voice", label: "VOICE PROFILE", placeholder: "How the character speaks, with sample dialogue..." },
] as const satisfies readonly FieldConfig[];

const LOCATION_FIELDS = [
  { key: "description", nodeType: "locationDescription", label: "DESCRIPTION", placeholder: "Detailed visual and atmospheric description of the location..." },
] as const satisfies readonly FieldConfig[];

const PROP_FIELDS = [
  { key: "description", nodeType: "propDescription", label: "DESCRIPTION", placeholder: "Description of the prop and its narrative significance..." },
] as const satisfies readonly FieldConfig[];

const CHARACTER_ROLES = ["protagonist", "antagonist", "supporting", "minor"] as const;

type CharacterRole = Character["role"];

export type { EntitySyncPayload, SupportedEntityType };

// =================== MAIN FUNCTIONS ====================

export function entityToProseDoc(entity: Entity): ProseDocument {
    if (!isSupportedEntityType(entity.type)) {
      throw new Error(`Unsupported entity type for prose sync: ${entity.type}`);
    }
  
    switch (entity.type) {
      case "CHARACTER":
        return buildCharacterDoc(entity);
      case "LOCATION":
        return buildLocationDoc(entity);
      case "PROP":
        return buildPropDoc(entity);
    }
}

export function proseDocToEntityMetadata(entity: Entity, doc: ProseDocument): EntityObject {
    if (!isSupportedEntityType(entity.type)) {
      throw new Error(`Unsupported entity type for prose sync: ${entity.type}`);
    }
  
    switch (entity.type) {
      case "CHARACTER":
        return parseCharacterDoc(entity, doc);
      case "LOCATION":
        return parseLocationDoc(entity, doc);
      case "PROP":
        return parsePropDoc(entity, doc);
    }
  }
  
// =================== HELPERS ====================

  export function proseDocToEntityPayload(entity: Entity, doc: ProseDocument): EntitySyncPayload {
    const metadata = proseDocToEntityMetadata(entity, doc);
    const name = normalizeText(metadata.name) || entity.name;
  
    return {
      id: entity.id,
      projectId: entity.projectId,
      type: entity.type,
      name,
      slug: getSlug(name),
      metadata,
      prose: doc,
    };
  }



function isSupportedEntityType(type: Entity["type"]): type is SupportedEntityType {
  return type === "CHARACTER" || type === "LOCATION" || type === "PROP";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeTraits(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((trait): trait is string => typeof trait === "string").map((trait) => trait.trim()).filter(Boolean)
    : [];
}

function normalizeCharacterRole(value: unknown, fallback: CharacterRole = "minor"): CharacterRole {
  return CHARACTER_ROLES.includes(value as CharacterRole) ? (value as CharacterRole) : fallback;
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

function buildFieldNode(field: FieldConfig, value: string): ProseNode {
  return {
    type: field.nodeType,
    attrs: {
      label: field.label,
      placeholder: field.placeholder,
    },
    content: toInlineContent(value),
  };
}

function getCharacterMetadata(entity: Entity): Character {
  const metadata = entity.metadata as Partial<Character>;

  return {
    name: normalizeText(metadata.name) || entity.name,
    role: normalizeCharacterRole(metadata.role),
    age: normalizeNumber(metadata.age),
    occupation: normalizeText(metadata.occupation),
    physicalDescription: normalizeText(metadata.physicalDescription),
    personalityTraits: normalizeTraits(metadata.personalityTraits),
    backstory: normalizeText(metadata.backstory),
    motivation: normalizeText(metadata.motivation),
    flaw: normalizeText(metadata.flaw),
    voice: normalizeText(metadata.voice),
  };
}

function getLocationMetadata(entity: Entity): Location {
  const metadata = entity.metadata as Partial<Location>;

  return {
    name: normalizeText(metadata.name) || entity.name,
    description: normalizeText(metadata.description),
  };
}

function getPropMetadata(entity: Entity): Prop {
  const metadata = entity.metadata as Partial<Prop>;

  return {
    name: normalizeText(metadata.name) || entity.name,
    description: normalizeText(metadata.description),
  };
}

function buildCharacterDoc(entity: Entity): ProseDocument {
  const metadata = getCharacterMetadata(entity);
  const content = CHARACTER_FIELDS.map((field) => {
    const value = field.key === "personalityTraits"
      ? metadata.personalityTraits.join(", ")
      : normalizeText(metadata[field.key as keyof Omit<Character, "name" | "role" | "age">]);

    return buildFieldNode(field, value);
  });

  const header: ProseNode = {
    type: "characterHeader",
    attrs: {
      name: metadata.name,
      role: metadata.role,
      age: metadata.age,
      thumbnail: "",
    },
  };

  return { type: "doc", content: [header, ...content] };
}

function buildLocationDoc(entity: Entity): ProseDocument {
  const metadata = getLocationMetadata(entity);
  const header: ProseNode = {
    type: "entityHeader",
    attrs: {
      name: metadata.name,
      thumbnail: "",
      entityType: "location",
    },
  };

  return {
    type: "doc",
    content: [
      header,
      ...LOCATION_FIELDS.map((field) => buildFieldNode(field, metadata.description)),
    ],
  };
}

function buildPropDoc(entity: Entity): ProseDocument {
  const metadata = getPropMetadata(entity);
  const header: ProseNode = {
    type: "entityHeader",
    attrs: {
      name: metadata.name,
      thumbnail: "",
      entityType: "prop",
    },
  };

  return {
    type: "doc",
    content: [
      header,
      ...PROP_FIELDS.map((field) => buildFieldNode(field, metadata.description)),
    ],
  };
}

function parseCharacterDoc(entity: Entity, doc: ProseDocument): Character {
  const base = getCharacterMetadata(entity);
  const next: Character = {
    ...base,
  };

  for (const node of doc.content ?? []) {
    if (node.type === "characterHeader") {
      next.name = normalizeText(node.attrs?.name) || next.name;
      next.role = normalizeCharacterRole(node.attrs?.role, next.role);
      next.age = normalizeNumber(node.attrs?.age, next.age);
      continue;
    }

    const field = CHARACTER_FIELDS.find((candidate) => candidate.nodeType === node.type);
    if (!field) {
      continue;
    }

    const text = extractTextFromNode(node);

    if (field.key === "personalityTraits") {
      next.personalityTraits = text.split(",").map((trait) => trait.trim()).filter(Boolean);
      continue;
    }

    next[field.key as keyof Omit<Character, "name" | "role" | "age">] = text as never;
  }

  return next;
}

function parseLocationDoc(entity: Entity, doc: ProseDocument): Location {
  const base = getLocationMetadata(entity);
  const next: Location = {
    ...base,
  };

  for (const node of doc.content ?? []) {
    if (node.type === "entityHeader") {
      next.name = normalizeText(node.attrs?.name) || next.name;
      continue;
    }
    if (node.type === "locationDescription") {
      next.description = extractTextFromNode(node);
    }
  }

  return next;
}

function parsePropDoc(entity: Entity, doc: ProseDocument): Prop {
  const base = getPropMetadata(entity);
  const next: Prop = {
    ...base,
  };

  for (const node of doc.content ?? []) {
    if (node.type === "entityHeader") {
      next.name = normalizeText(node.attrs?.name) || next.name;
      continue;
    }
    if (node.type === "propDescription") {
      next.description = extractTextFromNode(node);
    }
  }

  return next;
}
