import { useRef, useCallback, useEffect } from 'react'
import { IconMicrophone, IconMicrophoneOff, IconCaretUpFilled, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import { useVoiceInput } from '../hooks/use-voice-input'
import { ContextWindowDonut } from './context-window-donut'
import { MentionsInput, Mention } from 'react-mentions-ts'
import { useShallow } from 'zustand/shallow'

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
  onSend?: (params: sendParams) => void
  placeholder?: string
  disabled?: boolean
  isLoading?: boolean
  className?: string
}

export function ChatInput({
  onSend,
  placeholder = 'Ask anything... Use @ for characters, # for locations',
  disabled = false,
  isLoading = false,
  className,
}: ChatInputProps) {

  // Store
  const {characters, locations} = useChatStore(useShallow((state) => state.attachedContext))
  const setInputContent = useChatStore((state) => state.setInputContent)
  const appendInputContent = useChatStore((state) => state.appendInputContent)
  const inputContent = useChatStore((state) => state.inputContent)
  const editorBridge = useChatStore(state => state.editorBridge)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Voice input
  const voice = useVoiceInput({
    onTranscript: (transcript, isFinal) => {
      if (isFinal) {
        setInputContent(inputContent + transcript + ' ')
      }
    },
  })

  // Send message
  const handleSend = () => {
    const content = inputContent.trim()
    if (!content || disabled) return

    const payload: sendParams = {
      prompt: content,
      context: {
        blocks: [],
        selections: [],
      },
    }

    onSend?.(payload)
  }

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSend()
      }
  }

  const disableBtn = disabled || !inputContent.trim() || isLoading

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
        <Mention trigger="@" data={characters} renderSuggestion={(entry) => <div>{entry.display}</div>} />
        <Mention trigger="#" data={locations} />
        <Mention trigger="&&" data={[]}/>
      </MentionsInput>

      <div className='flex items-center justify-end gap-2 mt-2'>
        {/* Token usage donut */}
        <ContextWindowDonut usage={{percentage: 40}} size="sm" />

        {/* Voice input */}
        {voice.isSupported && (
          <Button
            size="icon-sm"
            onClick={voice.toggleRecording}
            disabled={disableBtn}
            className={cn(
              'size-6 bg-white/5 rounded-full text-gray-400 hover:bg-white/10 hover:text-white',
              voice.isRecording && 'text-red-500 animate-pulse'
            )}
            aria-label={voice.isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {voice.isRecording ? (
              <IconMicrophoneOff className="size-4" />
            ) : (
              <IconMicrophone className="size-4" />
            )}
          </Button>
        )}

        {/* Send button */}
        <Button
          variant="default"
          onClick={handleSend}
          disabled={disableBtn}
          className="size-6 rounded-full"
          aria-label="Send message"
        >
          {
            isLoading ? (
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