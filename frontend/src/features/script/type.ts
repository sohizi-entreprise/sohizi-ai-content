export type BlockType = 'title' | 'logline' | 'segment' | 'scene' | "segmentSummary" | 'snippet';
export type StatusType = 'planning' | 'writing' | 'reviewing' | 'revision' | 'complete' | 'error';

// type BaseBlock = {
//     id: string;
//     content: string;
//     type: BlockType;
//     parentId?: string;
// }

export type Block = {
    id: string;
    content: string;
    type: BlockType;
    parentId?: string;
    payload?: Record<string, any>;
    syncState?: string;
}

export type SnippetContext = {
    id: string;
    content: string;
    sourceBlockId: string;
    sourceBlockType: BlockType;
}

export type ScriptPlan = {
    title: string;
    logline: string;
    structure: {
        id: string;
        type: BlockType;
        parentId: string;
        order: number;
        content: string;
    }[];
}

export type StatusEvent = {
    type: StatusType;
    blockId?: string;
    iteration?: number;
    message: string;
};

export type Review = {
    approved: boolean;
    score: number;
    issues: {
        severity: "critical" | "major" | "minor";
        description: string;
        suggestion: string;
        affectedContent: string;
    }[];
    overallFeedback: string;
};

export type ScriptWriterEvent =
    | { type: "status"; data: StatusEvent }
    | { type: "plan_chunk"; data: Partial<ScriptPlan> }
    | { type: "plan_complete"; data: ScriptPlan }
    | { type: "block"; data: Partial<Block> }
    | { type: "review_chunk"; data: { blockId: string; chunk: Partial<Review> } }
    | { type: "review"; data: { blockId: string; review: Review; iteration: number } }
    | { type: "complete"; data: { blocks: Block[] } }
    | { type: "error"; data: { message: string } };


export type ErrorChunk = {
    type: "error";
    message: string;
}

export type AgentChunk = {
    runId: string;
    type: "chunk";
    data: string;
}

export type BlockChunk = {
    id: string;
    parentId: string;
    content: string;
    type: Block["type"];
}

export type ScriptStreamEventType = "start" | "error" | "agent" | "writer" | "reviewer" | "end";

export type ScriptStreamEvent = ErrorChunk | AgentChunk | BlockChunk;

export type ThoughtOutput = {
    outputType: "thought";
    content: string;
}
export type ResponseOutput = {
    outputType: "response" | "thought";
    content: string;
}
export type ActionOutput = {
    outputType: "action" | "pause";
    statusUpdate: string;
    toolCalls: {
        tool: string;
        args: Record<string, string>;
    }[];
}

export type ScriptEventLog = ResponseOutput | ActionOutput;
