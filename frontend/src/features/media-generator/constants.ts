import type { MediaGenerationSettings } from './types'

export const MEDIA_GENERATOR_TAB_ID = 'media-generator'
export const MEDIA_GENERATOR_TAB_NAME = 'media-generator'

export const mediaFilterOptions = [
  { value: 'all', label: 'All' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
] as const

export const mediaTypeOptions = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'audio', label: 'Audio' },
] as const

export const imageModels = [
  { value: 'flux-pro', label: 'Flux Pro' },
  { value: 'imagen-cinematic', label: 'Imagen Cinematic' },
  { value: 'dall-e-storyboard', label: 'DALL-E Storyboard' },
] as const

export const videoModels = [
  { value: 'veo-creative', label: 'Veo Creative' },
  { value: 'runway-gen', label: 'Runway Gen' },
  { value: 'pika-scene', label: 'Pika Scene' },
] as const

export const audioModels = [
  { value: 'elevenlabs-studio', label: 'ElevenLabs Studio' },
  { value: 'openai-voice', label: 'OpenAI Voice' },
  { value: 'musicgen-lite', label: 'MusicGen Lite' },
] as const

export const cameraAngles = [
  { value: 'eye-level', label: 'Eye level' },
  { value: 'low-angle', label: 'Low angle' },
  { value: 'high-angle', label: 'High angle' },
  { value: 'over-the-shoulder', label: 'Over the shoulder' },
  { value: 'drone', label: 'Drone' },
] as const

export const resolutions = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p' },
  { value: '4K', label: '4K' },
] as const

export const aspectRatios = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
] as const

export const voices = [
  { value: 'narrator', label: 'Narrator' },
  { value: 'warm', label: 'Warm' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'documentary', label: 'Documentary' },
] as const

export const defaultMediaSettings: MediaGenerationSettings = {
  image: {
    model: 'flux-pro',
    variations: 2,
    cameraAngle: 'eye-level',
    resolution: '1080p',
    aspectRatio: '16:9',
  },
  video: {
    model: 'veo-creative',
    duration: 6,
    resolution: '1080p',
    aspectRatio: '16:9',
  },
  audio: {
    model: 'elevenlabs-studio',
    voice: 'narrator',
    speed: 1,
    stability: 70,
  },
}
