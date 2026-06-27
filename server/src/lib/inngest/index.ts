import {
    handleImageGeneration,
    handleAudioGeneration,
    handleVideoGeneration,
} from '@/features/media-engine/inngest'

export {inngest} from './client'

export const functions = [
    handleImageGeneration,
    handleAudioGeneration,
    handleVideoGeneration,
]

