import { useState, useCallback, useRef, useEffect } from 'react'
import type { VoiceInputState } from '../types'

// Extend Window interface for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

type UseVoiceInputOptions = {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onError?: (error: string) => void
}

type UseVoiceInputReturn = VoiceInputState & {
  startRecording: () => void
  stopRecording: () => void
  toggleRecording: () => void
  clearTranscript: () => void
}

export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const {
    language = 'en-US',
    continuous = false,
    interimResults = true,
    onTranscript,
    onError,
  } = options

  const [isSupported, setIsSupported] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Check browser support
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    setIsSupported(!!SpeechRecognitionAPI)
    
    if (SpeechRecognitionAPI) {
      recognitionRef.current = new SpeechRecognitionAPI()
      recognitionRef.current.continuous = continuous
      recognitionRef.current.interimResults = interimResults
      recognitionRef.current.lang = language

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = ''
        let interimTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalTranscript += result[0].transcript
          } else {
            interimTranscript += result[0].transcript
          }
        }

        const currentTranscript = finalTranscript || interimTranscript
        setTranscript((prev) => prev + currentTranscript)
        
        if (onTranscript) {
          onTranscript(currentTranscript, !!finalTranscript)
        }
      }

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        const errorMessage = getErrorMessage(event.error)
        setError(errorMessage)
        setIsRecording(false)
        
        if (onError) {
          onError(errorMessage)
        }
      }

      recognitionRef.current.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current.onstart = () => {
        setIsRecording(true)
        setError(null)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
      }
    }
  }, [language, continuous, interimResults, onTranscript, onError])

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser')
      return
    }

    if (recognitionRef.current && !isRecording) {
      setTranscript('')
      setError(null)
      
      try {
        recognitionRef.current.start()
      } catch (err) {
        // Recognition might already be running
        console.error('Failed to start speech recognition:', err)
      }
    }
  }, [isSupported, isRecording])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
    }
  }, [isRecording])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  const clearTranscript = useCallback(() => {
    setTranscript('')
  }, [])

  return {
    isSupported,
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
    toggleRecording,
    clearTranscript,
  }
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'no-speech':
      return 'No speech was detected. Please try again.'
    case 'audio-capture':
      return 'No microphone was found. Please ensure a microphone is connected.'
    case 'not-allowed':
      return 'Microphone permission was denied. Please allow microphone access.'
    case 'network':
      return 'Network error occurred. Please check your connection.'
    case 'aborted':
      return 'Speech recognition was aborted.'
    case 'language-not-supported':
      return 'The selected language is not supported.'
    case 'service-not-allowed':
      return 'Speech recognition service is not allowed.'
    default:
      return `Speech recognition error: ${error}`
  }
}
