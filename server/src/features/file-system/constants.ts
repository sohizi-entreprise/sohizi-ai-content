export const fileFormat = {
    MARKDOWN: 'markdown',
    JSON: 'json',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    VIDEO_EDITOR: 'video-editor',
    AI_GENERATED: 'ai-generated',
    SKILL: 'skill',
} as const;

export const MAX_FILE_DEPTH = 5;
export const MAX_FILE_IN_DIRECTORY = 150;

export type FileFormat = (typeof fileFormat)[keyof typeof fileFormat];
export const FILE_FORMATS = [
    fileFormat.MARKDOWN,
    fileFormat.JSON,
    fileFormat.SKILL,
    fileFormat.AI_GENERATED,
    fileFormat.VIDEO_EDITOR,
] as const;