import { FileNode, FileNodeContent } from "@/db/schema";
import { fileFormat } from "./constants";

export const normalizeFileName = (name: string) => {
    return name.trim().toLowerCase().replace(/[\W\s\_]+/g, "-")
}



export function serializeFileContent(fileNode: FileNode, fileContent: FileNodeContent) {
    switch(fileNode.format){
        case fileFormat.JSON:
            return JSON.stringify(fileContent.jsonContent ?? {}, null, 2);
        default:
            return fileContent.content ?? '';
    }
}

export function proseToText(value: unknown): string {
    if (!value || typeof value !== 'object') {
        return '';
    }

    const node = value as {
        text?: string;
        content?: unknown[];
    };

    const textParts: string[] = [];

    if (typeof node.text === 'string' && node.text.length > 0) {
        textParts.push(node.text);
    }

    if (Array.isArray(node.content)) {
        for (const child of node.content) {
            const childText = proseToText(child);
            if (childText) {
                textParts.push(childText);
            }
        }
    }

    return textParts.join('\n').trim();
}

export function formatReadOutput(text: string, offset?: number, limit?: number) {
    if (offset !== undefined && offset < 1) {
        throw new Error('Offset must be greater than or equal to 1.')
    }
    if (limit !== undefined && limit < 1) {
        throw new Error('Limit must be greater than or equal to 1.')
    }

    if (offset === undefined && limit === undefined) {
        return text;
    }

    const lines = text === '' ? [] : text.split(/\r?\n/);
    if (lines.length === 0) {
        return '';
    }

    const start = offset ?? 1;
    const end = limit === undefined ? lines.length : Math.min(lines.length, start + limit - 1);

    if (start > lines.length) {
        return '';
    }

    return lines
        .slice(start - 1, end)
        .map((line, index) => `${start + index} | ${line}`)
        .join('\n');
}

export async function formatChunkResults(
    hits: Array<{
        fileNodeId: string;
        chunkIndex: number;
        chunkText: string;
        path: string;
        rank?: number;
        distance?: number;
    }>,
    scoreKey: 'rank' | 'distance',
) {
    if (hits.length === 0) {
        return 'No matches found.';
    }

    return hits.map((hit, index) => {
        const score = hit[scoreKey];
        const formattedScore = typeof score === 'number'
            ? scoreKey === 'distance'
                ? score.toFixed(4)
                : score.toFixed(3)
            : 'n/a';

        return [
            `${index + 1}. ${hit.path ?? `/[fileId: ${hit.fileNodeId}]`}`,
            `chunk: ${hit.chunkIndex}`,
            `${scoreKey}: ${formattedScore}`,
            hit.chunkText,
        ].join('\n');
    }).join('\n---\n');
}

export function countLines(text: string) {
    if (text === '') {
        return 0;
    }
    return text.split(/\r?\n/).length;
}

export function countWords(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
        return 0;
    }
    return trimmed.split(/\s+/).length;
}