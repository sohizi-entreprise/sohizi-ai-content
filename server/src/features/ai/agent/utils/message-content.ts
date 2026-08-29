import type { ModelMessage, UserModelMessage } from 'ai';

export function extractTextFromContent(content: ModelMessage['content']): string {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return JSON.stringify(content);
    }
    return content
        .map((part) => {
            if (part.type === 'text' || part.type === 'reasoning') {
                return part.text;
            }
            return JSON.stringify(part);
        })
        .join('\n');
}

export function extractTextFromUserMessage(message: UserModelMessage): string {
    return extractTextFromContent(message.content);
}
