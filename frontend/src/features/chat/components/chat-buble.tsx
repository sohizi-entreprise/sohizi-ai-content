import { memo } from 'react'
import { Message, MsgContent, MsgToolCallPart, MsgToolResultPart } from '../types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function messageContentLength(message: Message): number {
  return message.content.reduce((sum, part) => {
    if (part.type === 'text' || part.type === 'reasoning') return sum + part.text.length
    return sum
  }, 0)
}

function areMessagesEqual(prev: Message, next: Message): boolean {
  return prev.id === next.id && messageContentLength(prev) === messageContentLength(next)
}

const ChatBuble = memo(function ChatBuble({ data }: { data: Message }) {
  switch (data.role) {
    case 'user':
      return <RenderUserMessage message={data} />
    case 'assistant':
      return <RenderAssistantMessage message={data} />
    case 'tool':
      return <RenderToolResponse message={data} />
  }
}, (prev, next) => areMessagesEqual(prev.data, next.data))

export default ChatBuble

export const StreamingChatBubble = memo(function StreamingChatBubble({ data }: { data: Message }) {
  if (data.role !== 'assistant') return null
  return <RenderStreamingAssistantMessage message={data} />
}, (prev, next) => areMessagesEqual(prev.data, next.data))

export function insertToolResultsIntoAssistantMessages(messages: Message[]) {
  const toolResults = new Map<string, MsgToolResultPart>()

  for (const message of messages) {
    for (const part of message.content) {
      if (part.type === 'tool-result') {
        toolResults.set(part.toolCallId, part)
      }
    }
  }

  return messages
    .filter((message) => message.role !== 'tool')
    .map((message) => {
      if (message.role !== 'assistant') return message

      return {
        ...message,
        content: message.content.flatMap<MsgContent>((part, index) => {
          if (part.type !== 'tool-call') return [part]

          const nextPart = message.content[index + 1]
          if (nextPart?.type === 'tool-result' && nextPart.toolCallId === part.toolCallId) {
            return [part]
          }

          const toolResult = toolResults.get(part.toolCallId)
          return toolResult ? [part, toolResult] : [part]
        }),
      }
    })
}

function RenderUserMessage({ message }: { message: Message }) {
  const content = message.content.find((part) => part.type === 'text')
  return (
    <div className="text-sm text-foreground bg-white/10 p-2 rounded-lg break-all">
      {content?.text || ''}
    </div>
  )
}

function RenderAssistantMessage({ message }: { message: Message }) {
  let content = ''
  let reasoning = ''
  const toolCalls: Array<MsgToolCallPart & { result?: MsgToolResultPart }> = []
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
      case 'tool-result': {
        const toolCall = toolCalls.find((item) => item.toolCallId === part.toolCallId)
        if (toolCall) {
          toolCall.result = part
        }
        break
      }
    }
  }
  return (
    <div className="text-sm flex flex-col gap-2 p-2 w-full overflow-auto">
      {reasoning ? (
        <div className="text-gray-400 text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
        </div>
      ) : null}
      {content ? (
        <div className="text-white">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : null}
      {toolCalls.length > 0 ? (
        <div className="text-gray-400 space-y-2">
          {toolCalls.map((toolCall) => (
            <RenderToolCall key={toolCall.toolCallId} toolCall={toolCall} result={toolCall.result} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RenderStreamingAssistantMessage({ message }: { message: Message }) {
  let content = ''
  let reasoning = ''
  const toolCalls: Array<MsgToolCallPart & { result?: MsgToolResultPart }> = []
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
      case 'tool-result': {
        const toolCall = toolCalls.find((item) => item.toolCallId === part.toolCallId)
        if (toolCall) {
          toolCall.result = part
        }
        break
      }
    }
  }
  return (
    <div className="text-sm flex flex-col gap-2 p-2 w-full overflow-auto">
      {reasoning ? (
        <div className="text-gray-400 text-xs whitespace-pre-wrap">{reasoning}</div>
      ) : null}
      {content ? (
        <div className="text-white whitespace-pre-wrap">{content}</div>
      ) : null}
      {toolCalls.length > 0 ? (
        <div className="text-gray-400 space-y-2">
          {toolCalls.map((toolCall) => (
            <RenderStreamingToolCall
              key={toolCall.toolCallId}
              toolCall={toolCall}
              result={toolCall.result}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RenderToolResponse({ message }: { message: Message }) {
  const toolResult = message.content.find((part) => part.type === 'tool-result')
  return (
    <div className="text-xs text-gray-400 border border-gray-800 rounded-md p-2">
      {toolResult?.output.value ?? 'tool response'}
    </div>
  )
}

function RenderToolCall({
  toolCall,
  result,
}: {
  toolCall: MsgToolCallPart
  result?: MsgToolResultPart
}) {
  return (
    <div className="border border-gray-800 rounded-md p-2">
      <div className="text-gray-400 text-xs">{toolCall.toolName}</div>
      <div className="text-white">
        <div className="text-xs">{JSON.stringify(toolCall.input)}</div>
      </div>
      {result ? (
        <div className="mt-2 border-t border-gray-800 pt-2 text-xs text-gray-300 whitespace-pre-wrap">
          {result.output.value}
        </div>
      ) : null}
    </div>
  )
}

function RenderStreamingToolCall({
  toolCall,
  result,
}: {
  toolCall: MsgToolCallPart
  result?: MsgToolResultPart
}) {
  return (
    <div className="border border-gray-800 rounded-md p-2">
      <div className="text-gray-400 text-xs">{toolCall.toolName}</div>
      {toolCall.isStreaming ? (
        <div className="text-white text-xs text-muted-foreground">Running…</div>
      ) : (
        <div className="text-white text-xs whitespace-pre-wrap">{String(toolCall.input ?? '')}</div>
      )}
      {result ? (
        <div className="mt-2 border-t border-gray-800 pt-2 text-xs text-gray-300 whitespace-pre-wrap">
          {result.output.value}
        </div>
      ) : null}
    </div>
  )
}
