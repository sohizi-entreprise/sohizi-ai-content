import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { IconArrowRight, IconLoader2 } from '@tabler/icons-react'
import { MicOff, Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Props = {
    onSubmit: (text: string) => void
    isLoading?: boolean
}

export default function BriefInput( { onSubmit, isLoading = false }: Props ) {

    const recognitionRef = useRef<SpeechRecognition | null>(null)
    const [isListening, setIsListening] = useState(false)
    const [sourceStory, setSourceStory] = useState('')

    useEffect(() => {
        if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
          const recognition = new SpeechRecognition()
          recognitionRef.current = recognition
          recognition.continuous = true
          recognition.interimResults = true
    
          recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalTranscript = ''
            let interimTranscript = ''
    
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript
              if (event.results[i].isFinal) {
                finalTranscript += transcript
              } else {
                interimTranscript += transcript
              }
            }
    
            if (finalTranscript) {
              setSourceStory((prev) => prev + (prev ? ' ' : '') + finalTranscript)
            }
          }
    
          recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            console.error('Speech recognition error:', event.error)
            setIsListening(false)
            if (event.error === 'not-allowed') {
              toast.error('Microphone access denied. Please enable it in your browser settings.')
            }
          }
    
          recognition.onend = () => {
            setIsListening(false)
          }
        }
    
        return () => {
          if (recognitionRef.current) {
            recognitionRef.current.stop()
          }
        }
      }, [])

    const toggleListening = () => {
        if (!recognitionRef.current) {
            toast.error('Speech recognition is not supported in your browser')
            return
        }
        
        if (isListening) {
            recognitionRef.current.stop()
        } else {
            recognitionRef.current.start()
            setIsListening(true)
        }
    }

    const handleSubmit = () => {
        if (!sourceStory.trim()) {
            return
        } 
        onSubmit(sourceStory)
    }
  
  return (
    <div className="relative p-2 glass-panel rounded-2xl">
        <Textarea
        placeholder="Enter your story, script, or concept here. Describe characters, settings, and plot — the AI will structure it into scenes and shots..."
        value={sourceStory}
        onChange={(e) => setSourceStory(e.target.value)}
        className="min-h-[140px] resize-none border-0 bg-transparent! p-6 text-base text-white placeholder:text-muted-foreground focus-visible:ring-0"
        />
        <div className="flex items-center gap-2 justify-end">
        {/* Voice Input Button */}
        <button
            type="button"
            onClick={toggleListening}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
            isListening
                ? 'animate-pulse bg-red-500 text-white'
                : 'bg-white/10 text-neutral-400 hover:bg-white/20 hover:text-white'
            }`}
            title={isListening ? 'Stop listening' : 'Speak your concept'}
        >
            {isListening ? (
            <MicOff className="h-5 w-5" />
            ) : (
            <Mic className="h-5 w-5" />
            )}
        </button>

        <Button className='rounded-full font-bold' onClick={handleSubmit} disabled={!sourceStory.trim() || isLoading}>
            {isLoading ? (
                <>
                    Creating...
                    <IconLoader2 className="animate-spin" />
                </>
            ) : (
                <>
                    Continue
                    <IconArrowRight />
                </>
            )}
        </Button>
        </div>
    </div>
  )
}

// TypeScript declaration for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition
    }
    webkitSpeechRecognition: {
      new (): SpeechRecognition
    }
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent {
  error: string
  message: string
}
