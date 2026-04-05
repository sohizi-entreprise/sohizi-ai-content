import { projectRepo } from "@/entities/project";
import type { Entity, Project } from "@/db/schema";
import type { ProseDocument, ProseNode } from "@/type";
import { formatSceneBlock, getSlug } from "@/features/ai/utils";
import { entityToProseDoc } from "@/utils/entity-sync-engine";
import { convertScenesToProse } from "@/utils/script-sync-engine";
import { storyBibleToProseDoc } from "@/utils/world-sync-engine";
import {
    CharacterSchema,
    LocationSchema,
    PropSchema,
    editorOperationsPayloadSchema,
    synopsisSchema,
    sceneContentSchema,
    storyBibleSchema,
    type Character,
    type EditorEntityComponent,
    type EditorOperationsPayload,
    type EntityObject,
    type Location,
    type ProseNode as ZodProseNode,
    type Prop,
    type SceneContentSchema,
    type StoryBible,
    type Synopsis,
} from "zSchemas";
import { toJSONSchema } from "zod";

const ENTITY_TYPE_MAP = {
    character: "CHARACTER",
    location: "LOCATION",
    prop: "PROP",
} as const satisfies Record<"character" | "location" | "prop", Entity["type"]>;

type SupportedEntityType = keyof typeof ENTITY_TYPE_MAP;
type SupportedBlockType = "scene" | "synopsis" | "character" | "location" | "prop" | "story_bible";
type SynopsisTextNode = { type: "text"; text?: string };
type SynopsisNode = ProseNode | SynopsisTextNode;

export async function getScreenplayOutline(projectId: string) {
    const scenes = await projectRepo.getAllScenesForSync(projectId);

    if (scenes.length === 0) {
        return "";
    }

    return scenes
        .map((scene, index) => {
            const slugline = getSceneSlugline(scene.content);
            return `scene ${index + 1} [id=${scene.id}] : ${slugline}`;
        })
        .join("\n");
}

export async function getStoryBible(projectId: string) {
    const project = await projectRepo.getProjectById(projectId);
    if(!project?.story_bible){
        return "";
    }
    return JSON.stringify(project.story_bible);
}

export async function getSceneById(sceneId: string) {
    const scene = await projectRepo.getSceneById(sceneId);
    if (!scene) {
        return "";
    }

    return scene.content
        .map((block) => formatSceneBlock(block))
        .filter(Boolean)
        .join("\n\n");
}

export async function getEntityOutline(projectId: string, entityType: SupportedEntityType) {
    const result = await projectRepo.listEntities(
        projectId,
        undefined,
        100,
        ENTITY_TYPE_MAP[entityType]
    );

    if (result.items.length === 0) {
        return "";
    }

    return result.items
        .map((entity) => formatEntityOutlineLine(entity, entityType))
        .join("\n");
}

export async function getEntityDetail(entityId: string) {
    const entity = await projectRepo.getEntityById(entityId);
    if (!entity) {
        return "";
    }

    return JSON.stringify(entity.metadata);
}

export async function getProjectRequirements(project: Project) {
    if (!project.brief) {
        return "";
    }
    return JSON.stringify({
        format: project.brief.format,
        audience: project.brief.audience,
        genre: project.brief.genre,
        tone: project.brief.tone,
        maxDuration: project.brief.durationMin
    });
}

export async function searchScreenplay(projectId: string, query: string) {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return "";
    }

    const scenes = await projectRepo.searchScenes(projectId, query);
    const matches = scenes
        .map((scene, index) => {
            const sceneText = scene.content.map((block) => formatSceneBlock(block)).join("\n\n");
            const snippet = getMatchingSnippet(sceneText, normalizedQuery);
            return `scene ${index + 1} [id=${scene.id}] : ${snippet || "..."}`;
        })


    return matches.join("\n");
}

export async function getBlockSchema(blockType: SupportedBlockType) {
    const schema = getSchemaForBlockType(blockType);
    const rep = toJSONSchema(schema);
    return JSON.stringify(rep);
}

export async function getSynopsis(project: Project) {
    if (!project.synopsis) {
        return "";
    }
    return formatSynopsisAsText(project.synopsis);
}

export type MutationToolResult = {
    success: true;
    text: string;
    documentId: string;
    operations: EditorOperationsPayload["operations"];
};

export function synopsisToProseDoc(synopsis: Synopsis): ProseDocument {
    const content: ProseNode[] = [{
        type: "heading",
        content: [{ type: "text", text: synopsis.title }],
    }];

    const paragraphs = synopsis.content
        .split("\n\n")
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

    for (const paragraph of paragraphs) {
        content.push({
            type: "paragraph",
            content: [{ type: "text", text: paragraph }],
        });
    }

    return {
        type: "doc",
        content,
    };
}

export function getSceneNode(
    sceneId: string,
    content: SceneContentSchema
): Extract<ZodProseNode, { type: "scene" }> {
    const proseDoc = convertScenesToProse([{ id: sceneId, content }]);
    const sceneNode = proseDoc.content.find((node) => node.type === "scene");

    if (!sceneNode) {
        throw new Error(`Unable to build scene node for ${sceneId}.`);
    }

    return sceneNode as Extract<ZodProseNode, { type: "scene" }>;
}

export function getEntityDbType(component: EditorEntityComponent): Entity["type"] {
    switch (component) {
        case "character":
            return "CHARACTER";
        case "location":
            return "LOCATION";
        case "prop":
            return "PROP";
    }
}

export function getEntityProseDoc(
    projectId: string,
    component: EditorEntityComponent,
    content: Character | Location | Prop,
    componentId = `draft-${component}-${crypto.randomUUID()}`
): ProseDocument {
    const entity = {
        id: componentId,
        projectId,
        type: getEntityDbType(component),
        name: content.name,
        slug: getSlug(content.name),
        metadata: content,
        prose: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    } as Entity;

    return entityToProseDoc(entity);
}

export function createOperationsResult(
    text: string,
    payload: EditorOperationsPayload
): MutationToolResult {
    return {
        success: true,
        text,
        documentId: payload.documentId,
        operations: payload.operations,
    };
}

export function getEditorOperationsPayload(result: unknown): EditorOperationsPayload | null {
    if (!result || typeof result !== "object") {
        return null;
    }

    const candidate = result as {
        success?: unknown;
        documentId?: unknown;
        operations?: unknown;
    };

    if (candidate.success !== true) {
        return null;
    }

    const parsed = editorOperationsPayloadSchema.safeParse({
        documentId: candidate.documentId,
        operations: candidate.operations,
    });

    return parsed.success ? parsed.data : null;
}
function getSceneSlugline(content: unknown) {
    if (!Array.isArray(content)) {
        return "UNTITLED SCENE";
    }

    const slugline = content.find(
        (block): block is { type: string; text: string } =>
            !!block &&
            typeof block === "object" &&
            "type" in block &&
            "text" in block &&
            block.type === "slugline" &&
            typeof block.text === "string"
    );

    return slugline?.text?.trim() || "UNTITLED SCENE";
}

function formatEntityOutlineLine(entity: { id: string; metadata: unknown }, entityType: SupportedEntityType) {
    const metadata = (entity.metadata ?? {}) as Partial<EntityObject> & { role?: string; description?: string };

    switch (entityType) {
        case "character":
            return `${metadata.name ?? "Unknown"} [id=${entity.id}] : ${metadata.role ?? "supporting"}`;
        case "location":
        case "prop":
            return `${metadata.name ?? "Unknown"} [id=${entity.id}] : ${metadata.description ?? ""}`.trim();
    }
}

function getMatchingSnippet(text: string, normalizedQuery: string) {
    const normalizedText = text.toLowerCase();
    const matchIndex = normalizedText.indexOf(normalizedQuery);
    if (matchIndex === -1) {
        return null;
    }

    const start = Math.max(0, matchIndex - 60);
    const end = Math.min(text.length, matchIndex + normalizedQuery.length + 60);
    return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function getSchemaForBlockType(blockType: SupportedBlockType) {
    switch (blockType) {
        case "scene":
            return sceneContentSchema;
        case "synopsis":
            return synopsisSchema;
        case "character":
            return CharacterSchema;
        case "location":
            return LocationSchema;
        case "prop":
            return PropSchema;
        case "story_bible":
            return storyBibleSchema;
    }
}

function formatSynopsisAsText(doc: ProseDocument | null | undefined): string {
    if (!doc?.content?.length) {
        return "";
    }

    let title = "";
    const sections: string[] = [];

    for (const node of doc.content) {
        if (node.type === "heading" || node.type === "title") {
            const headingText = getNodeText(node).trim();
            if (headingText && !title) {
                title = headingText;
            }
            continue;
        }

        if (node.type === "paragraph") {
            const paragraphText = getNodeText(node).trim();
            if (!paragraphText) {
                continue;
            }

            const paragraphId = String(node.attrs?.id ?? "unknown");
            sections.push(`paragraph [id=${paragraphId}]\n${paragraphText}`);
        }
    }

    const lines: string[] = [];
    if (title) {
        lines.push(`title: ${title}`);
    }

    if (sections.length > 0) {
        if (lines.length > 0) {
            lines.push("");
        }
        lines.push(sections.join("\n\n"));
    }

    return lines.join("\n");
}

function getNodeText(node: SynopsisNode): string {
    if (typeof node.text === "string") {
        return node.text;
    }

    if (!("content" in node) || !Array.isArray(node.content)) {
        return "";
    }

    return node.content
        .map((child: SynopsisNode) => {
            if (typeof child !== "object" || child == null) {
                return "";
            }

            if ("text" in child && typeof child.text === "string") {
                return child.text;
            }

            return getNodeText(child);
        })
        .join("");
}
