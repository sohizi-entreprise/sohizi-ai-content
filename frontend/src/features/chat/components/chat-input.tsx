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
  const {characters, locations, selections} = useChatStore(useShallow((state) => state.attachedContext))
  const removeSelectionContext = useChatStore((state) => state.removeSelectionContext)
  const setInputContent = useChatStore((state) => state.setInputContent)
  const inputContent = useChatStore((state) => state.inputContent)
  const isInputFocused = useChatStore(state => state.ui.isInputFocused)
  const setInputFocused = useChatStore((state) => state.setInputFocused)

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
        blocks: selections.map(selection => selection.blockId).filter(t => t !== undefined),
        selections: selections.map(selection => selection.id),
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
    if (inputRef.current && isInputFocused) {
      inputRef.current.focus()
    }
  }, [isInputFocused])

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
      removeSelectionContext(id)
    })
    
    // Update ref for next comparison
    prevSelectionIdsRef.current = newIds
    
    // Update the input content
    setInputContent(nextValue)
  }, [removeSelectionContext, setInputContent])

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
                      onMentionBlur={()=> setInputFocused(false)}
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
        <Mention trigger="&&" data={selections}/>
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