import { projectRepo } from "@/entities/project";
import type { ProseDocument, ProseNode } from "@/type";

// ---------------------------------------------------------------------------
// Prose / Tiptap document → plain text
// ---------------------------------------------------------------------------

function extractTextFromNode(node: ProseNode): string {
    if (typeof node.text === "string") return node.text;
    if (!Array.isArray(node.content)) return "";
    return node.content
        .map((c) =>
            c && typeof c === "object" && "text" in c
                ? (c as { text?: string }).text ?? ""
                : extractTextFromNode(c as ProseNode)
        )
        .join("");
}

/**
 * Converts a Tiptap/ProseMirror document to plain text.
 * Walks all top-level nodes, extracts their text content, and joins with newlines.
 */
export function proseDocumentToPlainText(doc: ProseDocument | null | undefined): string {
    if (!doc?.content || !Array.isArray(doc.content)) return "";
    return doc.content
        .map((node) => extractTextFromNode(node))
        .filter(Boolean)
        .join("\n");
}

export function slug(name: string, prefix?: string): string {
    return (prefix ? `${prefix}_` : "") + name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
}

export function batch<T>(arr: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
        batches.push(arr.slice(i, i + size));
    }
    return batches;
}


export function getSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[\s\-]+/g, "_")      // spaces AND hyphens → underscore
        .replace(/[^a-z0-9_]/g, "")    // remove invalid chars
        .replace(/_+/g, "_")           // collapse multiple underscores
        .replace(/^_|_$/g, "");        // trim leading/trailing underscores
}