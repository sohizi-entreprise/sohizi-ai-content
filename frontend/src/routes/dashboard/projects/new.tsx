import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState, useRef, useEffect } from 'react'
import { createProject } from '@/lib/server/projects'
import { generateOutline } from '@/lib/server/ai'
import { PROJECT_FORMATS, type ProjectFormat } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sparkles, BookOpen, Clapperboard, Mic, Lightbulb, ArrowUp, Wand2, MicOff } from 'lucide-react'
import { toast } from 'sonner'
import { Link } from '@tanstack/react-router'
import { AuroraBackground } from '@/components/ui/aurora-background'
import { GlowingEffect } from '@/components/ui/glowing-effect'
import { NoiseBackground } from '@/components/ui/noise-background'

export const Route = createFileRoute('/dashboard/projects/new')({
  component: NewProjectPage,
})

const FORMAT_CONFIG: Record<
  ProjectFormat,
  { label: string; description: string; icon: React.ElementType }
> = {
  storytime: {
    label: 'Story Time',
    description: 'Narrative-driven content',
    icon: BookOpen,
  },
  explainer: {
    label: 'Explainer',
    description: 'Educational breakdown',
    icon: Lightbulb,
  },
  documentary: {
    label: 'Documentary',
    description: 'Real-world subjects',
    icon: Clapperboard,
  },
  presenter: {
    label: 'Presenter',
    description: 'Host-led content',
    icon: Mic,
  },
}

function NewProjectPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [format, setFormat] = useState<ProjectFormat>('storytime')
  const [sourceStory, setSourceStory] = useState('')
  const [tone, setTone] = useState('')
  const [genre, setGenre] = useState('')
  const [showNameDialog, setShowNameDialog] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true

      recognitionRef.current.onresult = (event) => {
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

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please enable it in your browser settings.')
        }
      }

      recognitionRef.current.onend = () => {
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
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
      toast.success('Listening... Speak your concept')
    }
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      // Create project
      const result = await createProject({
        data: { name: name || 'Untitled Project', format },
      })

      // Generate outline if story provided
      if (sourceStory.trim()) {
        await generateOutline({
          data: {
            projectId: result.projectId,
            sourceStory,
            tone: tone || null,
            genre: genre || null,
            targetLengthSec: null,
            stylePackId: null,
          },
        })
      }

      return result
    },
    onSuccess: (result) => {
      setShowNameDialog(false)
      toast.success('Project created!')
      navigate({
        to: '/projects/$projectId/outline',
        params: { projectId: result.projectId },
      })
    },
    onError: (error) => {
      toast.error('Failed to create project')
      console.error(error)
    },
  })

  const handleStartGeneration = (e?: React.FormEvent) => {
    e?.preventDefault()
    // Stop listening if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
    setShowNameDialog(true)
  }

  const handleConfirmCreate = () => {
    createMutation.mutate()
  }

  return (
    <AuroraBackground className="font-geist min-h-screen bg-[#0a0a0f] dark:bg-[#0a0a0f] px-4 py-16">
      {/* Back Link */}
      <Link 
        to="/projects" 
        className="absolute left-6 top-6 z-20 text-sm text-muted-foreground transition-colors hover:text-white"
      >
        ← Back to Projects
      </Link>

      {/* Title */}
      <div className="relative z-10 mb-12 text-center">
        <h1 className="font-geist text-4xl font-bold tracking-tight text-white md:text-5xl">
          Create your next video
        </h1>
        <p className="mt-3 text-lg text-neutral-400">
          AI-powered storyboarding in seconds
        </p>
      </div>

      {/* Format Selection */}
      <div className="relative z-10 mb-8 flex flex-wrap justify-center gap-3">
        {PROJECT_FORMATS.map((f) => {
          const config = FORMAT_CONFIG[f]
          const Icon = config.icon
          const isSelected = format === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`group relative flex flex-col items-center gap-2 rounded-xl border px-6 py-4 transition-all ${
                isSelected
                  ? 'border-violet-500/50 bg-violet-500/10 text-white'
                  : 'border-white/10 bg-white/5 text-neutral-400 hover:border-white/20 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-violet-500/50 bg-violet-500/20'
                    : 'border-white/10 bg-white/5 group-hover:border-white/20'
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-violet-400' : ''}`} />
              </div>
              <span className={`text-sm font-medium ${isSelected ? 'text-violet-400' : ''}`}>
                {config.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Main Glass Container */}
      <div className="relative z-10 w-full max-w-3xl">
        <NoiseBackground
          containerClassName="rounded-2xl p-1 bg-neutral-900/80"
          gradientColors={[
            "rgb(139, 92, 246)",
            "rgb(192, 132, 252)",
            "rgb(236, 72, 153)",
          ]}
          noiseIntensity={0.15}
          speed={0.08}
        >
          <div className="relative rounded-xl">
            <GlowingEffect
              blur={0}
              borderWidth={1}
              spread={40}
              glow={true}
              disabled={false}
              proximity={64}
              inactiveZone={0.01}
            />
            <form
              onSubmit={handleStartGeneration}
              className="relative rounded-xl border border-white/10 bg-[#0a0a0f]/90 p-6 backdrop-blur-xl"
            >
            {/* Story Input Header */}
            <div className="mb-4">
              <span className="text-sm font-medium text-muted-foreground">
                Describe your video concept
              </span>
            </div>

            {/* Main Textarea */}
            <div className="relative mb-6">
              <Textarea
                placeholder="Enter your story, script, or concept here. Describe characters, settings, and plot — the AI will structure it into scenes and shots..."
                value={sourceStory}
                onChange={(e) => setSourceStory(e.target.value)}
                className="min-h-[140px] resize-none border-0 bg-transparent p-0 pr-24 text-base text-white placeholder:text-neutral-500 focus-visible:ring-0"
              />
              <div className="absolute bottom-0 right-0 flex items-center gap-2">
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
                {/* Submit Button */}
                <button
                  type="submit"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-white transition-all hover:bg-violet-400"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Options Row */}
            <div className="flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Tone</span>
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger className="h-8 w-32 border-white/10 bg-white/5 text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inspirational">Inspirational</SelectItem>
                    <SelectItem value="dramatic">Dramatic</SelectItem>
                    <SelectItem value="comedic">Comedic</SelectItem>
                    <SelectItem value="educational">Educational</SelectItem>
                    <SelectItem value="mysterious">Mysterious</SelectItem>
                    <SelectItem value="heartwarming">Heartwarming</SelectItem>
                    <SelectItem value="thrilling">Thrilling</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-500">Genre</span>
                <Select value={genre} onValueChange={setGenre}>
                  <SelectTrigger className="h-8 w-32 border-white/10 bg-white/5 text-sm">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="narrative">Narrative</SelectItem>
                    <SelectItem value="documentary">Documentary</SelectItem>
                    <SelectItem value="tutorial">Tutorial</SelectItem>
                    <SelectItem value="promotional">Promotional</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </form>
          </div>
        </NoiseBackground>

        {/* Hint text */}
        <p className="mt-4 text-center text-sm text-neutral-500">
          Tip: The more detail you provide, the better your storyboard will be
        </p>
      </div>

      {/* Generate Button */}
      <div className="relative z-10 mt-8">
        <Button
          onClick={handleStartGeneration}
          size="lg"
          className="h-12 gap-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 text-base font-medium hover:from-violet-500 hover:to-fuchsia-500"
        >
          <Wand2 className="h-4 w-4" />
          Start Generating
        </Button>
      </div>

      {/* Project Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Name your project</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Give your project a name to help you find it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="My Awesome Video"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-white/10 bg-white/5 text-white placeholder:text-neutral-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleConfirmCreate()
                }
              }}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setShowNameDialog(false)}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCreate}
              disabled={createMutation.isPending}
              className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500"
            >
              {createMutation.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Let's Go!
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuroraBackground>
  )
}

// Add TypeScript declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}
