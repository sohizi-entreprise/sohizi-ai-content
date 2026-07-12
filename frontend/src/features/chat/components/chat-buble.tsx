import { useMemo } from 'react'
import { Message, MsgToolCallPart, MsgToolResultPart } from '../types'
import {
  Message as UIMessage,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  type AttachmentData,
} from '@/components/ai-elements/attachments'
import { ChatToolCall } from './chat-tool-call'

type AggregatedAssistant = {
  content: string
  reasoning: string
  reasoningStreaming: boolean
  toolCalls: Array<MsgToolCallPart & { result?: MsgToolResultPart }>
}

function aggregateAssistant(message: Message): AggregatedAssistant {
  let content = ''
  let reasoning = ''
  let reasoningStreaming = false
  const toolCalls: Array<MsgToolCallPart & { result?: MsgToolResultPart }> = []

  for (const part of message.content) {
    switch (part.type) {
      case 'text':
        content += part.text
        break
      case 'reasoning':
        reasoning += part.text
        reasoningStreaming = part.isStreaming ?? false
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

  return { content, reasoning, reasoningStreaming, toolCalls }
}

function ChatBuble({ data }: { data: Message }) {
  switch (data.role) {
    case 'user':
      return <RenderUserMessage message={data} />
    case 'assistant':
      return <RenderAssistantMessage message={data} />
    case 'tool':
      return null
  }
}

export default ChatBuble

export function StreamingChatBubble({ data }: { data: Message }) {
  if (data.role !== 'assistant') return null
  return <RenderAssistantMessage message={data} />
}

function RenderUserMessage({ message }: { message: Message }) {
  const content = message.content.find((part) => part.type === 'text')

  const attachments = useMemo<AttachmentData[]>(() => {
    if (message.role !== 'user') return []
    return message.content
      .filter((part) => part.type === 'image' || part.type === 'file')
      .map((part, i) => {
        if (part.type === 'image') {
          return {
            id: `${message.id}-img-${i}`,
            type: 'file' as const,
            url: String(part.image),
            mediaType: 'image/*',
          }
        }
        return {
          id: `${message.id}-file-${i}`,
          type: 'file' as const,
          url: String(part.data),
          mediaType: part.mediaType,
        }
      })
  }, [message])

  return (
    <UIMessage from="user" className='max-w-full ml-0'>
      {attachments.length > 0 && (
        <Attachments variant="grid" className="mb-1 ml-0">
          {attachments.map((file) => (
            <Attachment key={file.id} data={file} className='size-16 border'>
              <AttachmentPreview />
            </Attachment>
          ))}
        </Attachments>
      )}
      <MessageContent className='w-full dark:bg-surface'>
        <MessageResponse>{content?.text || ''}</MessageResponse>
      </MessageContent>
    </UIMessage>
  )
}

function RenderAssistantMessage({ message }: { message: Message }) {
  const { content, reasoning, reasoningStreaming, toolCalls } = aggregateAssistant(message)

  return (
    <UIMessage from="assistant">
      <MessageContent className="gap-3">
        {reasoning ? (
          <Reasoning isStreaming={reasoningStreaming}>
            <ReasoningTrigger />
            <ReasoningContent>{reasoning}</ReasoningContent>
          </Reasoning>
        ) : null}

        {/* Text accompanying tool calls is a progress update, so it precedes them. */}
        {content ? <MessageResponse>{content}</MessageResponse> : null}

        {toolCalls.length > 0 ? (
          <div className="flex flex-col gap-2">
            {toolCalls.map((toolCall) => (
              <ChatToolCall
                key={toolCall.toolCallId}
                toolCall={toolCall}
                result={toolCall.result}
              />
            ))}
          </div>
        ) : null}
      </MessageContent>
    </UIMessage>
  )
}
