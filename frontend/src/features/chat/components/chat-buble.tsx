import { Message, MsgTextPart, MsgToolCallPart, MsgToolResultPart, ReasoningPart } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ChatBuble({data}: {data: Message}) {
    switch (data.role) {
        case 'user':
            return <RenderUserMessage message={data} />
        case 'assistant':
            return <RenderAssistantMessage message={data} />
        case 'tool':
            return <RenderToolResponse message={data} />
    }
}

function RenderUserMessage({message}: {message: Message}) {
    const content = message.content.find((part) => part.type === 'text')
    return (
        <div className="text-sm text-foreground bg-white/10 p-2 rounded-lg">
            {content?.text || ''}
        </div>
    )
}

function RenderAssistantMessage({message}: {message: Message}) {
    let content = ''
    let reasoning = ''
    let toolCalls: MsgToolCallPart[] = []
    for (const part of message.content) {
        switch (part.type) {
            case 'text':
                content += part.text
                break
        case 'reasoning':
            reasoning += part.text
            break
        case 'tool-call':
            toolCalls.push(part)
            break
    }
    }
    return (
        <div className="text-sm flex flex-col gap-2 p-2">
            <div className="text-gray-400 text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
            </div>
            <div className="text-white">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
            <div className="text-gray-400">
                {toolCalls.map((toolCall) => (
                    <div key={toolCall.toolCallId}>{toolCall.toolName}</div>
                ))}
            </div>
        </div>
    )
}

function RenderToolResponse({message}: {message: Message}) {
    return (
        <div>tool response</div>
    )
}