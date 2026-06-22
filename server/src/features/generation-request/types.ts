import { YieldEventType } from "../ai/stream-llm";

export type TaskUpdateStreamEvent = YieldEventType<unknown> & {
    event: "TASK_UPDATE";
    requestId: string;
};

export type ChatChunkStreamEvent = {
    event: "CHAT_CHUNK";
    requestId: string;
    data: unknown;
};

export type SSEStreamEvent = {
    event: 'chat-completion' | 'media-generation' | 'caption-generation' | 'error';
    requestId: string;
    data: unknown;
} & Partial<Pick<TaskUpdateStreamEvent, "type" | "finishReason" | "alertType">>;
