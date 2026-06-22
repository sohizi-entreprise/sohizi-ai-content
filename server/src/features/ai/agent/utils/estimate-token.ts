import { ModelMessage } from "ai";
import { encodeChat } from 'gpt-tokenizer';


export function estimateInputTokens(messages: ModelMessage[], overEstimateFactor: number = 1.2): number {
    const sanitizedMessages = sanitizeMessages(messages);
    const encoded = encodeChat(sanitizedMessages);
    return Math.ceil(encoded.length * overEstimateFactor);
}

function sanitizeMessages(messages: ModelMessage[]): {role: ModelMessage["role"], content: string}[] {
    return messages.map((message) => ({
        role: message.role,
        content: sanitizeContent(message.content),
    }));
}

function sanitizeContent(content: ModelMessage["content"]): string {
    if (typeof content === 'string') {
        return content;
    }

    if (!Array.isArray(content)) {
        return JSON.stringify(content);
    }

    return content.map((part) => {
        if (part.type === 'text' || part.type === 'reasoning') {
            return part.text;
        }

        return JSON.stringify(part);
    }).join('\n');
}