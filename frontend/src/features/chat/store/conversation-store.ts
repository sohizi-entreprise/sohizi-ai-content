import { create } from 'zustand'
import { z } from 'zod'
import { Conversation, ConversationRun } from '../types'
import { EditorAIBridge } from '../hooks/use-ai-editor-bridge'
import { v4 as uuidv4 } from 'uuid'

type ConversationState = {
  currentConversation: Conversation | null
  currentRun: ConversationRun | null
  runs: ConversationRun[]
  isHistoryOpen: boolean
  isSendingMessage: boolean
  isStreaming: boolean
  bridge: EditorAIBridge | null
}

type ConversationActions = {
  setCurrentConversation: (conversation: Conversation | null) => void
  setCurrentRun: (run: ConversationRun | null) => void
  setRuns: (runs: ConversationRun[]) => void
  appendRun: (run: ConversationRun) => void
  sendMessage: () => void
  toggleHistory: (value?: boolean) => void
  setIsSendingMessage: (isSending: boolean) => void
  setIsStreaming: (isStreaming: boolean) => void
  updateReasoningChunk: (data: {runId: string, stepId: string, text: string}) => void
  updateTextChunk: (data: {runId: string, stepId: string, text: string}) => void
  updateToolCallChunk: (data: {runId: string, stepId: string, toolName: string, toolId: string, args: unknown}) => void
  updateToolCallDelta: (data: {runId: string, stepId: string, toolName: string, toolId: string, args: string, type: 'tool_call_delta' | 'tool_call_start' | 'tool_call_end' }) => void
  updateWritingChunk: (data: {runId: string, stepId: string, text: string}) => void
  setBridge: (bridge: EditorAIBridge | null) => void
}

const insertOperation = z.object({
    type: z.literal('insert'),
    blockType: z.string(),
    content: z.string().min(1),
    insertAfterBlockId: z.string().min(1),
  })
  
  const deleteOperation = z.object({
    type: z.literal('delete'),
    blockId: z.string().min(1),
    content: z.string().default(''),
  })
  
  const updateOperation = z.object({
    type: z.literal('update'),
    blockId: z.string().min(1),
    content: z.string().min(1),
  })

const initialState: ConversationState = {
  currentConversation: null,
  currentRun: null,
  runs: [],
  isHistoryOpen: false,
  isSendingMessage: false,
  isStreaming: false,
  bridge: null,
}

export const useConversationStore = create<ConversationState & ConversationActions>((set) => ({
  ...initialState,
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setCurrentRun: (run) => set({ currentRun: run }),
  setRuns: (runs) => set({ runs }),
  appendRun: (run) => set((state) => ({ runs: [...state.runs, run] })),
  sendMessage: () => {},
  toggleHistory: (value) => set((state) => ({ isHistoryOpen: value !== undefined ? value : !state.isHistoryOpen })),
  setIsSendingMessage: (isSending) => set({ isSendingMessage: isSending }),
  setIsStreaming: (isStreaming) => set({ isStreaming: isStreaming }),

  updateReasoningChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [],
            runId: data.runId,
            metadata: {
                reasoningText: data.text,
            },
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    const currentText = message.metadata?.reasoningText || ''
    const newMessage = {
        ...message,
        metadata: {
            ...(message.metadata || {}),
            reasoningText: currentText + data.text,
        },
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateTextChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [{type: 'text' as const, text: data.text}],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    const textPart = message.content.find(part => part.type === 'text')
    const currentText = textPart?.text ?? ''
    const newText = currentText + data.text
    // If reasoning created the message first, content may be [] — we must add a text part
    const newContent = textPart
      ? message.content.map(part => part.type === 'text' ? { ...part, text: newText } : part)
      : [...message.content, { type: 'text' as const, text: newText }]
    const newMessage = {
      ...message,
      content: newContent,
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateToolCallChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state

    // Check if the tool call is editing the content. If so, dispatch the action to show diff editor
    if(data.toolName === 'editContent' && state.bridge){
        const args = (data.args as {operation: unknown}).operation
        dispatchDiffEditorAction(args, state.bridge)
    }
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)

    const toolContent = {
        type: 'tool-call' as const,
        toolName: data.toolName,
        toolCallId: data.toolId,
        input: JSON.stringify(data.args),
        isLoading: false,
    }
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [toolContent],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }

    const existingIndex = message.content.findIndex(
      (part) => part.type === 'tool-call' && part.toolCallId === data.toolId
    )
    const newContent =
      existingIndex >= 0
        ? message.content.map((part, i) => (i === existingIndex ? toolContent : part))
        : [...message.content, toolContent]

    const newMessage = { ...message, content: newContent }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateToolCallDelta: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    const baseToolContent = {
        type: 'tool-call' as const,
        toolName: data.toolName,
        toolCallId: data.toolId,
        isLoading: data.type === 'tool_call_start' || data.type === 'tool_call_delta',
    }
    if(!message){
        const toolContent = {
            ...baseToolContent,
            input: data.args,
        }
        const newMessage = {
            id: data.stepId,
            role: 'assistant' as const,
            content: [toolContent],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }

    const existingIndex = message.content.findIndex(
      (part) => part.type === 'tool-call' && part.toolCallId === data.toolId
    )
    const newContent =
      existingIndex >= 0
        ? message.content.map((part, i) =>
            i === existingIndex && part.type === 'tool-call'
              ? { ...baseToolContent, input: (part.input || '') + data.args }
              : part
          )
        : [...message.content, { ...baseToolContent, input: data.args }]

    const newMessage = { ...message, content: newContent }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  updateWritingChunk: (data) => set((state) => {
    if(!state.currentRun || state.currentRun.runId !== data.runId) return state
    const message = state.currentRun.messages.find(msg => msg.id === data.stepId)
    
    if(!message){
        const newMessage = {
            id: data.stepId,
            role: 'tool' as const,
            content: [{
                type: 'tool-result' as const,
                toolName: 'write-content',
                toolCallId: data.stepId,
                output: {type: 'text' as const, value: data.text},
            }],
            runId: data.runId,
            createdAt: new Date().toISOString(),
        }
        return {currentRun: {
            ...state.currentRun,
            messages: [...state.currentRun.messages, newMessage],
        }}
    }
    
    const newMessage = {
        ...message,
        content: message.content.map(part => part.type === 'tool-result' ? {...part, output: {type: 'text' as const, value: (part.output?.value || '') + data.text}} : part),
    }
    return {currentRun: {
        ...state.currentRun,
        messages: state.currentRun.messages.map(msg => msg.id === data.stepId ? newMessage : msg),
    }}
  }),

  setBridge: (bridge) => set({ bridge }),
}))


function dispatchDiffEditorAction(data: unknown, bridge: EditorAIBridge) {
    const isValid = typeof data === 'object' && data !== null && ('type' in data)
    if(!isValid ) return

    const baseBlock = {
        type: "paragraph" as const,
    }

    switch(data.type){
        case 'insert': {
            const operation = insertOperation.safeParse(data).data
            if(!operation) return
            const position = bridge.getContextAnchorPosition(operation.insertAfterBlockId)
            if(!position) return

            const newContent = [getDiffBlockContent(operation.content, uuidv4(), 'aiAddition')]
            const editorObject = {...baseBlock, content: newContent}

            bridge.execute({type: 'INSERT_TEXT', from: position.to + 1, content: editorObject})
            break
        }
        case 'delete':{
            const operation = deleteOperation.safeParse(data).data
            if(!operation) return
            const position = bridge.getContextAnchorPosition(operation.blockId)
            if(!position) return
            const newContent = [getDiffBlockContent(position.text, operation.blockId, 'aiDeletion')]
            // const text = `[[${position.text}]]`
            bridge.execute({type: 'REPLACE_TEXT', ...position, content: newContent })
            break
        }
        case 'update':
            {
                const operation = updateOperation.safeParse(data).data
                if(!operation) return
                const position = bridge.getContextAnchorPosition(operation.blockId)
                if(!position) return
                const newContent = [
                    getDiffBlockContent(position.text + ' ', operation.blockId, 'aiDeletion'),
                    getDiffBlockContent(operation.content, operation.blockId, 'aiAddition'), 
                ]
                // const text = `[[${position.text}]] \n {{${operation.content}}}`
                bridge.execute({type: 'REPLACE_TEXT', from: position.from, to: position.to, content: newContent})
                break
            }
    }
}

function getDiffBlockContent(text:string, identifier:string, markType: 'aiDeletion' | 'aiAddition'){
    const idPrefix = markType === 'aiDeletion' ? 'deletion' : 'addition'

    return {
        text,
        type: "text" as const,
        marks: [
            {
                type: markType,
                attrs: {
                    blockId: `${idPrefix}-${identifier}`
                }
            }
        ]
    }
}
