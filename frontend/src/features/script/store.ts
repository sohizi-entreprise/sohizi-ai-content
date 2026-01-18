import { create } from 'zustand';
import { Block, BlockType } from './type';
import { persist } from 'zustand/middleware'

interface ScriptStore {
    blocks: Block[];
    isStreamingBlocks: boolean;
    readonly: boolean;
    aiBlockContext: Block[];
    setBlocks: (blocks: Block[]) => void;
    addBlock: (type: BlockType, index: number, parentId?: string) => void;
    updateBlock: (id: string, content: string) => void;
    removeBlock: (id: string) => void;
    addOrRemoveAiBlockContext: (block: Block) => void;
    clearAiBlockContext: () => void;
    setReadonly: (readonly: boolean) => void;
}

export const useScriptStore = create<ScriptStore>()(persist((set) => ({
    blocks: [],
    isStreamingBlocks: false,
    readonly: false,
    aiBlockContext: [],
    setBlocks: (blocks) => set({ blocks }),
    addBlock: (type, index, parentId) => set((state) => {
        const newBlocks = geInitialBlock(type, parentId);
        return { blocks: [...state.blocks.slice(0, index+1), ...newBlocks, ...state.blocks.slice(index+1)] }
    }),
    updateBlock: (id, content) => set((state) => ({ blocks: state.blocks.map(b => b.id === id ? { ...b, syncState: content } : b) })),
    removeBlock: (id) => set((state) => {
        const block = state.blocks.find(b => b.id === id);
        if(block?.type === 'segment'){
            return { blocks: state.blocks.filter(b => b.id !== id && b.parentId !== id),  aiBlockContext: state.aiBlockContext.filter(b => b.id !== block.id)}
        }
        return { blocks: state.blocks.filter(b => b.id !== id), aiBlockContext: state.aiBlockContext.filter(b => b.id !== block?.id) }
    }),

    addOrRemoveAiBlockContext: (block) => set((state) => {
        const existingBlock = state.aiBlockContext.find(b => b.id === block.id);
        if(existingBlock){
            return { aiBlockContext: state.aiBlockContext.filter(b => b.id !== block.id) }
        }
        return { aiBlockContext: [...state.aiBlockContext, block] }
    }),
    clearAiBlockContext: () => set({ aiBlockContext: [] }),
    setReadonly: (readonly) => set({ readonly }),
}), {
    name: 'script-store',
}));



function geInitialBlock(type: BlockType, parentId: string = ''){

    switch(type){
        case 'segment':
            const segmentId = `seg${new Date().getTime()}`;
            return [{ id: segmentId, content: 'Segment Title', type}, { id: `${segmentId}-summary`, content: 'Segment Summary ...', type: 'summary', parentId: segmentId }] as Block[]
        case 'scene':
            const sceneId = `scene${new Date().getTime()}`;
            return [{id: sceneId, content: 'Start writing your scene here...', type, parentId}] as Block[]
        default:
            return [] as Block[]
    }

}