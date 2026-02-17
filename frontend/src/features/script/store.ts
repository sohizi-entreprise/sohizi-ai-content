import { create } from 'zustand';
import { Block, BlockType, ScriptEventLog, ScriptPlan, SnippetContext, StatusEvent } from './type';

interface ScriptStore {
    blocks: Block[];
    isStreaming: boolean;
    readonly: boolean;
    aiBlockContext: Block[];
    snippetContexts: SnippetContext[];
    scriptPlan: Partial<ScriptPlan> | null;
    streamingStatus: StatusEvent | null;
    eventLogs: {
        runId: string;
        data: ScriptEventLog | Partial<ScriptEventLog>;
    }[];
    setBlocks: (blocks: Block[]) => void;
    addBlock: (type: BlockType, index: number, parentId?: string) => void;
    updateBlock: (id: string, content: string) => void;
    removeBlock: (id: string) => void;
    addOrRemoveAiBlockContext: (block: Block) => void;
    clearAiBlockContext: () => void;
    addSnippetContext: (snippet: Omit<SnippetContext, 'id'>) => void;
    removeSnippetContext: (id: string) => void;
    clearSnippetContexts: () => void;
    setReadonly: (readonly: boolean) => void;
    bulkUpdateBlocks: (data: {id: string, content: string}[]) => void;
    setStreaming: (isStreaming: boolean) => void;
    setScriptPlan: (scriptPlan: Partial<ScriptPlan>) => void;
    setStreamingStatus: (status: StatusEvent) => void;
    addBlockChunk: (block: Block) => void;
    upsertEventLog: (runId: string, data: ScriptEventLog | Partial<ScriptEventLog>) => void;
}

export const useScriptStore = create<ScriptStore>()((set) => ({
    blocks: [],
    isStreaming: false,
    readonly: false,
    aiBlockContext: [],
    snippetContexts: [],
    scriptPlan: null,
    streamingStatus: null,
    eventLogs: [],
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
        // Limit to 3 blocks - remove the first one if we're at capacity
        const newContext = state.aiBlockContext.length >= 3 
            ? [...state.aiBlockContext.slice(1), block]
            : [...state.aiBlockContext, block];
        return { aiBlockContext: newContext }
    }),
    clearAiBlockContext: () => set({ aiBlockContext: [] }),
    addSnippetContext: (snippet) => set((state) => {
        const newSnippet = { ...snippet, id: `snippet_${Date.now()}_${Math.random().toString(36).slice(2, 9)}` };
        // Limit to 3 snippets - remove the first one if we're at capacity
        const newSnippets = state.snippetContexts.length >= 3
            ? [...state.snippetContexts.slice(1), newSnippet]
            : [...state.snippetContexts, newSnippet];
        return { snippetContexts: newSnippets }
    }),
    removeSnippetContext: (id) => set((state) => ({
        snippetContexts: state.snippetContexts.filter(s => s.id !== id)
    })),
    clearSnippetContexts: () => set({ snippetContexts: [] }),
    setReadonly: (readonly) => set({ readonly }),
    bulkUpdateBlocks: (data) => set((state) => {
        const newContent = data.reduce((acc, d) => {
            acc[d.id] = d.content;
            return acc;
        }, {} as Record<string, string>);
        return { blocks: state.blocks.map(b => newContent[b.id] !== undefined ? { ...b, content: newContent[b.id] } : b) }
    }),
    setStreaming: (isStreaming) => set({ isStreaming }),
    setScriptPlan: (scriptPlan) => set({ scriptPlan }),
    setStreamingStatus: (status) => set({ streamingStatus: status }),
    addBlockChunk: (block) => set((state) => {
        // const idx = state.blocks.findIndex(b => b.id === block.id);
        const existingBlock = state.blocks.find(b => b.id === block.id);
        if (existingBlock) {
            const updatedBlock = {...existingBlock, content: existingBlock.content + block.content };
            return { blocks: state.blocks.map(b => b.id === block.id ? updatedBlock : b) }
        }
        return { blocks: [...state.blocks, block] }
    }),
    upsertEventLog: (runId, data) => set((state) => {
        const existingLog = state.eventLogs.find(l => l.runId === runId);
        if(existingLog){
            return { eventLogs: state.eventLogs.map(l => l.runId === runId ? { ...l, data } : l) }
        }
        return { eventLogs: [...state.eventLogs, { runId, data }] }
    }),
})
);



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