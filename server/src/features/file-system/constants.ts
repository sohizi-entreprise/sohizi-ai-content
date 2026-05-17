export const fileFormat = {
    MARKDOWN: 'markdown',
    FOUNTAIN: 'fountain',
    JSON: 'json',
    IMAGE: 'image',
    VIDEO: 'video',
    AUDIO: 'audio',
    DOCUMENT: 'document',
    VIDEO_EDITOR: 'video-editor',
    IMAGE_EDITOR: 'image-editor',
    AI_GENERATED: 'ai-generated',
} as const;

export const MAX_FILE_DEPTH = 5;
export const MAX_FILE_IN_DIRECTORY = 150;

export type FileFormat = (typeof fileFormat)[keyof typeof fileFormat];
export const FILE_FORMATS = [fileFormat.MARKDOWN, fileFormat.FOUNTAIN, fileFormat.JSON] as const;