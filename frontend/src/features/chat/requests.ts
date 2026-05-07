import api from "@/lib/axios"
import { createParser, type EventSourceMessage } from "eventsource-parser"
import type { FileNode } from "../projects/type"
import { ChatCompletionRequest, ChatStreamChunk, Conversation, LlmModel, Message } from "./types"

export type CursorPaginationOptions = {
    cursor?: string;
    limit?: number;
}

export type CursorPaginationResult<T> = {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

export type DeleteConversationResponse = {
    ok: boolean;
    error: string | null;
}



export const listConversations = async (
    projectId: string,
    options?: CursorPaginationOptions,
): Promise<CursorPaginationResult<Conversation>> => {
    const response = await api.get(`/chats/${projectId}/conversations`, { params: options })
    return response.data
}

export const deleteConversation = async (projectId: string, id: string): Promise<DeleteConversationResponse> => {
    const response = await api.delete(`/chats/${projectId}/conversations/${id}`)
    return response.data
}

export const getConversationMessages = async (
    projectId: string,
    id: string,
    options?: CursorPaginationOptions,
): Promise<CursorPaginationResult<Message>> => {
    const response = await api.get(`/chats/${projectId}/conversations/${id}/messages`, { params: options })
    return response.data
}

export const listModels = async (projectId: string): Promise<LlmModel[]> => {
    const response = await api.get(`/chats/${projectId}/models`)
    return response.data
}

export const searchFilesByName = async (
    projectId: string,
    name: string,
    limit?: number,
    options?: { signal?: AbortSignal },
): Promise<FileNode[]> => {
    const response = await api.get(`/projects/${projectId}/files/search`, {
        params: { name, limit },
        signal: options?.signal,
    })
    return response.data
}


export async function* completeChat(
    projectId: string,
    data: ChatCompletionRequest,
    options?: { signal?: AbortSignal },
): AsyncGenerator<ChatStreamChunk, void, unknown> {
    const response = await fetch(`${api.defaults.baseURL ?? ''}/chats/${projectId}/conversations/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: options?.signal,
    })

    if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`)
    }

    if (!response.body) {
        throw new Error('No response body')
    }

    for await (const event of parseSseStream(response.body)) {
        if (!event.data) continue
        yield JSON.parse(event.data) as ChatStreamChunk
    }
}

async function* parseSseStream(stream: ReadableStream<Uint8Array>) {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    const events: EventSourceMessage[] = []
    const parser = createParser({
        onEvent: (event) => {
            events.push(event)
        },
    })

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            parser.feed(decoder.decode(value, { stream: true }))

            while (events.length > 0) {
                yield events.shift()!
            }
        }

        const remaining = decoder.decode()
        if (remaining) {
            parser.feed(remaining)
        }

        parser.reset({ consume: true })

        while (events.length > 0) {
            yield events.shift()!
        }
    } finally {
        reader.releaseLock()
    }
}
