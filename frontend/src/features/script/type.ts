export type BlockType = 'title' | 'logline' | 'segment' | 'scene' | 'summary';

export type Block = {
    id: string;
    content: string;
    type: BlockType;
    parentId?: string;
    payload?: Record<string, any>;
    syncState?: string;
}