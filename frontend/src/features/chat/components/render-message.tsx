import { Message, MsgTextPart, MsgToolResultPart } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function RenderMessage({ message }: { message: Message }) {
    const isUser = message.role === 'user'
    const isAssistant = message.role === 'assistant'
    if(isUser) return <RenderUserMessage message={message} />
    if(isAssistant) return <RenderAssistantMessage message={message} />
    return <RenderToolResponse message={message} />
}

function RenderUserMessage({ message }: { message: Message }) {

    return (
        <div className='border border-white/10 bg-gray-700 rounded-lg p-2 sticky top-0'>
            {
                message.content.map((ct, index) => (
                    <p key={index}>{(ct as MsgTextPart).text}</p>
                
                ))
            }
        </div>
    )
}

function RenderAssistantMessage({ message }: { message: Message }) {
    const reasoning = message.metadata?.reasoningText ?? ''
    const content = Array.isArray(message.content) ? message.content : []
    return (
        <div className="prose prose-sm prose-invert max-w-none">
            {
                reasoning && <p className='text-sm text-muted-foreground mb-2'>Thinking: {reasoning}</p>
            }
            {
                content.map((part, index) => {
                    if (part.type === 'text') {
                        return (
                            <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>
                                {part.text}
                            </ReactMarkdown>
                        )
                    }
                    if (part.type === 'tool-call') {
                        return (
                            <div key={index} className='border border-white/10 p-4 my-2'>
                                <p>{part.isLoading ? 'Loading...' : ''}</p>
                                <p>{part.toolName}</p>
                                <p>{typeof part.input === 'string' ? part.input : JSON.stringify(part.input)}</p>
                            </div>
                        )
                    }
                    return null
                })
            }
        </div>
    )
}

function RenderToolResponse({ message }: { message: Message }) {
    if(message.role !== 'tool') return null

    const content = message.content as MsgToolResultPart[]
    return (
        <div className='border border-white/10 p-4'>
            <p>Tool Response</p>
            {
                content.map((ct, index) => (
                    <div key={index}>
                        <p>{ct.toolName}</p>
                        <p>
                            {JSON.stringify(ct.output)}
                        </p>
                    </div>
                ))
            }
        </div>
    )
}

