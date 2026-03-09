import { Message, MsgTextPart, MsgToolCallPart, MsgToolResultPart } from '../types'
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
    const { content, toolCalls } = extractContent(message)
    return (
        <div className="prose prose-sm prose-invert max-w-none">
            {
                reasoning && <p className='text-sm text-muted-foreground mb-2'>Thinking: {reasoning}</p>
            }
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content.join('\n')}
            </ReactMarkdown>

            {
                toolCalls.map((toolCall, index) => (
                    <div key={index} className='border border-white/10 p-4'>
                        <p>{toolCall.toolName}</p>
                        <p>{JSON.stringify(toolCall.input)}</p>
                    </div>
                ))
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

function extractContent(message: Message) {

    const content = []
    const toolCalls: MsgToolCallPart[] = []

    for(const ct of message.content) {
        if(ct.type === 'text') {
            content.push(ct.text)
        } else if(ct.type === 'tool-call') {
            toolCalls.push(ct)
        }
    }
    return { content, toolCalls }
}
