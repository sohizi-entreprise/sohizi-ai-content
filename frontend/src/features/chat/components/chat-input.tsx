import { useState, useRef, useCallback, useEffect } from 'react'
import { IconMicrophone, IconMicrophoneOff, IconSend, IconPlayerPlay, IconCircleArrowRightFilled, IconArrowBigRightFilled, IconCaretUpFilled } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '../store/chat-store'
import { useMentions } from '../hooks/use-mentions'
import { useVoiceInput } from '../hooks/use-voice-input'
import { ContextChipList } from './context-chip'
import { ContextWindowDonut, calculateTokenUsage } from './context-window-donut'
import { MentionsInput, Mention } from 'react-mentions-ts'
import type { MentionItem, Message } from '../types'
import { useShallow } from 'zustand/shallow'

type ChatInputProps = {
  onSend?: (message: Omit<Message, 'id' | 'conversationId' | 'createdAt'>) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ChatInput({
  onSend,
  placeholder = 'Ask anything... Use @ for characters, # for locations',
  disabled = false,
  className,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Store
  const {characters, locations, selections} = useChatStore(useShallow((state) => state.attachedContext))
  const addSelectionContext = useChatStore((state) => state.addSelectionContext)
  const removeSelectionContext = useChatStore((state) => state.removeSelectionContext)
  const setInputContent = useChatStore((state) => state.setInputContent)
  const inputContent = useChatStore((state) => state.inputContent)
  const clearInput = useChatStore((state) => state.clearInput)
  const isInputFocused = useChatStore(state => state.ui.isInputFocused)
  const setInputFocused = useChatStore((state) => state.setInputFocused)
  const isSending = useChatStore((state) => state.isSending)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Voice input
  const voice = useVoiceInput({
    onTranscript: (transcript, isFinal) => {
      if (isFinal) {
        setInputValue((prev) => prev + transcript + ' ')
      }
    },
  })

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {

      // Cmd/Ctrl + Enter to send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSend()
        return
      }
    },
    []
  )

  // Send message
  const handleSend = useCallback(() => {
    const content = inputValue.trim()
    if (!content || disabled || isSending) return

    const message: Omit<Message, 'id' | 'conversationId' | 'createdAt'> = {
      role: 'user',
      content,
    }

    onSend?.(message)
    
    // Clear input
    clearInput()
    // Note: Context is cleared by the parent after successful send
  }, [inputValue, disabled, isSending, onSend, clearInput])

  const isDisabled = disabled || isSending

  useEffect(() => {
    if (inputRef.current && isInputFocused) {
      inputRef.current.focus()
    }
  }, [isInputFocused])

  return (
    <div className={cn('border bg-white/5 m-4 p-2 rounded-xl overflow-hidden', className)}>
      <MentionsInput value={inputContent} 
                      onMentionsChange={({ value: nextValue }) => setInputContent(nextValue)}
                      suggestionsPlacement="above"
                      inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
                      onMentionBlur={()=> setInputFocused(false)}
                      autoResize
                      classNames={{
                        input: 'bg-transparent! max-h-50 text-sm',
                        control: 'bg-transparent! border-none'
                      }}
                      placeholder='@ for characters, # for locations'
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
            disabled={isDisabled}
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
          disabled={isDisabled || !inputValue.trim()}
          className="size-6 rounded-full"
          aria-label="Send message"
        >
          <IconCaretUpFilled className="size-4" />
        </Button>
      </div>
      
    </div>
  )
}