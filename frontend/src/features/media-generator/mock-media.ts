import type {
  GenerateMediaInput,
  GeneratedMediaItem,
  MediaGenerationSettings,
  MediaVariant,
} from './types'

const sampleVideoUrl =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const sampleAudioUrl =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3'

const aspectDimensions = {
  '1:1': { width: 1024, height: 1024 },
  '4:3': { width: 1280, height: 960 },
  '16:9': { width: 1280, height: 720 },
  '9:16': { width: 720, height: 1280 },
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function titleFromPrompt(prompt: string, type: GenerateMediaInput['type']) {
  const cleanPrompt = prompt.trim()
  if (!cleanPrompt) {
    return `${type[0].toUpperCase()}${type.slice(1)} concept`
  }

  const title = cleanPrompt.split(/\s+/).slice(0, 7).join(' ')
  return title[0].toUpperCase() + title.slice(1)
}

export function createMockMediaItem(
  input: GenerateMediaInput,
  settings: MediaGenerationSettings,
): GeneratedMediaItem {
  const id = createId(input.type)
  const createdAt = new Date().toISOString()
  const prompt = input.prompt.trim() || `A cinematic ${input.type} concept`
  const title = titleFromPrompt(prompt, input.type)

  if (input.type === 'image') {
    const imageSettings = settings.image
    const dimensions = aspectDimensions[imageSettings.aspectRatio]
    const variants: Array<MediaVariant> = Array.from({
      length: imageSettings.variations,
    }).map((_, index) => {
      const seed = encodeURIComponent(`${id}-${index}-${prompt}`)
      return {
        id: createId('variant'),
        url: `https://picsum.photos/seed/${seed}/${dimensions.width}/${dimensions.height}`,
        ...dimensions,
      }
    })

    return {
      id,
      type: 'image',
      title,
      prompt,
      model: imageSettings.model,
      createdAt,
      thumbnailUrl: variants[0]?.url,
      variants,
      settings: {
        variations: imageSettings.variations,
        cameraAngle: imageSettings.cameraAngle,
        resolution: imageSettings.resolution,
        aspectRatio: imageSettings.aspectRatio,
      },
    }
  }

  if (input.type === 'video') {
    const videoSettings = settings.video
    return {
      id,
      type: 'video',
      title,
      prompt,
      model: videoSettings.model,
      createdAt,
      url: sampleVideoUrl,
      thumbnailUrl: `https://picsum.photos/seed/${encodeURIComponent(`${id}-video`)}/1280/720`,
      durationSeconds: videoSettings.duration,
      settings: {
        duration: videoSettings.duration,
        resolution: videoSettings.resolution,
        aspectRatio: videoSettings.aspectRatio,
      },
    }
  }

  const audioSettings = settings.audio
  return {
    id,
    type: 'audio',
    title,
    prompt,
    model: audioSettings.model,
    createdAt,
    url: sampleAudioUrl,
    durationSeconds: 12,
    settings: {
      voice: audioSettings.voice,
      speed: audioSettings.speed,
      stability: audioSettings.stability,
    },
  }
}
