export const fileFormat = {
    MARKDOWN: 'markdown',
    FOUNTAIN: 'fountain',
    JSON: 'json',
} as const;

export const MAX_FILE_DEPTH = 5;
export const MAX_FILE_IN_DIRECTORY = 150;

export type FileFormat = (typeof fileFormat)[keyof typeof fileFormat];
export const FILE_FORMATS = [fileFormat.MARKDOWN, fileFormat.FOUNTAIN, fileFormat.JSON] as const;