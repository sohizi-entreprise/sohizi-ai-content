export const imageSizePresets = [
  "auto",
  "square",
  "landscape",
  "portrait",
  "2k-square",
  "2k-landscape",
  "4k-landscape",
  "4k-portrait",
] as const

export type ImageSizePreset = (typeof imageSizePresets)[number]

/** Map UI/Lumen-style presets to OpenRouter image params. */
export const openRouterImagePresetMap: Record<
  ImageSizePreset,
  { aspectRatio?: string; resolution?: "512" | "1K" | "2K" | "4K" }
> = {
  auto: { aspectRatio: "auto" },
  square: { aspectRatio: "1:1", resolution: "1K" },
  landscape: { aspectRatio: "16:9", resolution: "1K" },
  portrait: { aspectRatio: "9:16", resolution: "1K" },
  "2k-square": { aspectRatio: "1:1", resolution: "2K" },
  "2k-landscape": { aspectRatio: "16:9", resolution: "2K" },
  "4k-landscape": { aspectRatio: "16:9", resolution: "4K" },
  "4k-portrait": { aspectRatio: "9:16", resolution: "4K" },
}

export const googleTtsVoices = [
  "Achernar",
  "Achird",
  "Algenib",
  "Algieba",
  "Alnilam",
  "Aoede",
  "Autonoe",
  "Callirrhoe",
  "Charon",
  "Despina",
  "Enceladus",
  "Erinome",
  "Fenrir",
  "Gacrux",
  "Iapetus",
  "Kore",
  "Laomedeia",
  "Leda",
  "Orus",
  "Puck",
  "Pulcherrima",
  "Rasalgethi",
  "Sadachbia",
  "Sadaltager",
  "Schedar",
  "Sulafat",
  "Umbriel",
  "Vindemiatrix",
  "Zephyr",
  "Zubenelgenubi",
] as const

export type GoogleTtsVoice = (typeof googleTtsVoices)[number]

export type GoogleVoiceDescription = {
  name: GoogleTtsVoice
  gender: "female" | "male"
  description: string
  previewUrl: string
}

const GOOGLE_VOICE_PREVIEW_BASE =
  "https://media-dev.sohizi.com/utils/voices-gemini"

function voicePreviewUrl(name: GoogleTtsVoice): string {
  return `${GOOGLE_VOICE_PREVIEW_BASE}/chirp3-hd-${name.toLowerCase()}.wav`
}

const googleVoiceDescriptionBase: Array<
  Omit<GoogleVoiceDescription, "previewUrl">
> = [
  { name: "Achernar", gender: "female", description: "Soft, Higher pitch" },
  {
    name: "Achird",
    gender: "male",
    description: "Friendly, Lower middle pitch",
  },
  { name: "Algenib", gender: "male", description: "Gravelly, Lower pitch" },
  { name: "Algieba", gender: "male", description: "Smooth, Lower pitch" },
  { name: "Alnilam", gender: "male", description: "Firm, Lower middle pitch" },
  { name: "Aoede", gender: "female", description: "Breezy, Middle pitch" },
  { name: "Autonoe", gender: "female", description: "Bright, Middle pitch" },
  {
    name: "Callirrhoe",
    gender: "female",
    description: "Easy-going, Middle pitch",
  },
  { name: "Charon", gender: "male", description: "Informative, Lower pitch" },
  { name: "Despina", gender: "female", description: "Smooth, Middle pitch" },
  { name: "Enceladus", gender: "male", description: "Breathy, Lower pitch" },
  { name: "Erinome", gender: "female", description: "Clear, Middle pitch" },
  {
    name: "Fenrir",
    gender: "male",
    description: "Excitable, Lower middle pitch",
  },
  { name: "Gacrux", gender: "female", description: "Mature, Middle pitch" },
  { name: "Iapetus", gender: "male", description: "Clear, Lower middle pitch" },
  { name: "Kore", gender: "female", description: "Firm, Middle pitch" },
  { name: "Laomedeia", gender: "female", description: "Upbeat, Higher pitch" },
  { name: "Leda", gender: "female", description: "Youthful, Higher pitch" },
  { name: "Orus", gender: "male", description: "Firm, Lower middle pitch" },
  { name: "Puck", gender: "male", description: "Upbeat, Middle pitch" },
  {
    name: "Pulcherrima",
    gender: "female",
    description: "Forward, Middle pitch",
  },
  {
    name: "Rasalgethi",
    gender: "male",
    description: "Informative, Middle pitch",
  },
  { name: "Sadachbia", gender: "male", description: "Lively, Lower pitch" },
  {
    name: "Sadaltager",
    gender: "male",
    description: "Knowledgeable, Middle pitch",
  },
  { name: "Schedar", gender: "male", description: "Even, Lower middle pitch" },
  { name: "Sulafat", gender: "female", description: "Warm, Middle pitch" },
  {
    name: "Umbriel",
    gender: "male",
    description: "Easy-going, Lower middle pitch",
  },
  {
    name: "Vindemiatrix",
    gender: "female",
    description: "Gentle, Middle pitch",
  },
  { name: "Zephyr", gender: "female", description: "Bright, Higher pitch" },
  {
    name: "Zubenelgenubi",
    gender: "male",
    description: "Casual, Lower middle pitch",
  },
]

export const googleVoiceDescriptions: GoogleVoiceDescription[] =
  googleVoiceDescriptionBase.map((voice) => ({
    ...voice,
    previewUrl: voicePreviewUrl(voice.name),
  }))
