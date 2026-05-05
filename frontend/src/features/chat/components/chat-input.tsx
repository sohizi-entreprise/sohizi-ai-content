import { useRef, useCallback, useEffect } from 'react'
import { IconCaretUpFilled, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import { ContextWindowDonut } from './context-window-donut'
import { MentionsInput, Mention } from 'react-mentions-ts'
import { ChatCompletionRequest } from '../types'
import ChatSelectModel from './chat-select-model'
import { toast } from 'sonner'
import { useSendMessage } from '../hooks/use-chat'

// Helper to extract selection IDs from mention markup
// Matches pattern: &&[display](id)
function extractSelectionIds(content: string): string[] {
  const regex = /&&\[[^\]]*\]\(([^)]+)\)/g
  const ids: string[] = []
  let match
  while ((match = regex.exec(content)) !== null) {
    ids.push(match[1])
  }
  return ids
}

export type sendParams = {
  prompt: string
  context: {
    blocks: string[];
    selections: string[];
    // locations?: string[];
    // characters?: string[];
  }
}

type ChatInputProps = {
  projectId: string
  placeholder?: string
  className?: string
}

export function ChatInput({
  projectId,
  placeholder = 'Ask anything... Use @ for characters, # for locations',
  className,
}: ChatInputProps) {

  // Store
  const setInputContent = useChatStore((state) => state.setUserPrompt)
  const appendInputContent = useChatStore((state) => state.appendUserPrompt)
  const inputContent = useChatStore((state) => state.userPrompt)
  const editorBridge = useChatStore(state => state.editorBridge)
  const isStreaming = useChatStore(state => state.isStreaming)
  const conversation = useChatStore(state => state.activeConversation)
  const model = useChatStore(state => state.model)

  const sendMessage = useSendMessage(projectId)

  const conversationId = conversation?.id ?? null
  const modelId = model?.id

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const disableSendButton = !inputContent.trim() || isStreaming

  // Send message
  const handleSend = async () => {
    const content = inputContent.trim()
    if (disableSendButton) return

    if(!modelId){
      toast.error('Please select a model')
      return
    }

    const payload: ChatCompletionRequest = {
      userPrompt: content,
      conversationId,
      modelId
    }

    // Send request
    await sendMessage(payload)
  }

  // Handle keyboard events
  const handleKeyDown = async(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        await handleSend()
      }
  }

  useEffect(() => {
    if (!editorBridge?.isReady) return
    // Clear all context anchors when this input mounts
    editorBridge.execute({ type: 'CLEAR_CONTEXT_ANCHOR' })
    const unsubscribe = editorBridge.subscribe((event) => {
      switch (event.type) {
        case 'CONTEXT_SELECTED':
          const formattedText = ` &&[${event.data.display}](${event.data.id})`
          appendInputContent(formattedText)
          inputRef.current?.focus()
          break
      }
    })
    return () => {
      unsubscribe()
    }
  }, [editorBridge])

  // Track previous selection IDs to detect removals
  const prevSelectionIdsRef = useRef<string[]>([])

  // Handle input change and detect removed selections
  const handleInputChange = useCallback(({ value: nextValue }: { value: string }) => {
    // Extract selection IDs from old and new content
    const prevIds = prevSelectionIdsRef.current
    const newIds = extractSelectionIds(nextValue)
    
    // Find removed selection IDs
    const removedIds = prevIds.filter(id => !newIds.includes(id))
    
    // Remove each selection from the store (which will notify the editor)
    removedIds.forEach(id => {
      editorBridge?.execute({ type: 'CLEAR_CONTEXT_ANCHOR', blockId: id })
      inputRef.current?.focus()
    })
    
    // Update ref for next comparison
    prevSelectionIdsRef.current = newIds
    
    // Update the input content
    setInputContent(nextValue)
  }, [editorBridge, setInputContent])

  // Keep the ref in sync when content changes externally (e.g., when adding a selection)
  useEffect(() => {
    prevSelectionIdsRef.current = extractSelectionIds(inputContent)
  }, [inputContent])

  return (
    <div className={cn('border bg-white/5 m-4 p-2 rounded-xl overflow-hidden', className)}>
      <MentionsInput value={inputContent} 
                      onMentionsChange={handleInputChange}
                      suggestionsPlacement="above"
                      inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
                      autoResize
                      classNames={{
                        input: 'bg-transparent! max-h-50 text-sm',
                        control: 'bg-transparent! border-none'
                      }}
                      placeholder={placeholder}
                      onKeyDown={handleKeyDown}
      >
        <Mention trigger="@" data={[]} />
        <Mention trigger="#" data={[]} />
        <Mention trigger="&&" data={[]}/>
      </MentionsInput>

      <div className='flex items-center justify-end gap-2 mt-2'>
        {/* Token usage donut */}
        <ContextWindowDonut usage={{percentage: 40}} size="sm" />

        <ChatSelectModel projectId={projectId} />

        
        {/* Send button */}
        <Button
          variant="default"
          onClick={handleSend}
          disabled={disableSendButton}
          className="size-6 rounded-full"
          aria-label="Send message"
        >
          {
            isStreaming ? (
              <IconLoader2 className="size-4 animate-spin" />
            ) : (
              <IconCaretUpFilled className="size-4" />
            )
          }
        </Button>
      </div>
      
    </div>
  )
}