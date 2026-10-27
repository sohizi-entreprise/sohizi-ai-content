const modelsTracker = {
  explorer: "openai/gpt-6-luna",
  webSearcher: "openai/gpt-6-luna",
  summarizer: "google/gemini-2.5-flash-lite",
  imageAnalyzer: "google/gemini-3.1-flash-lite",
  videoAnalyzer: "google/gemini-3.1-flash-lite",
  youtubeAnalyzer: "google/gemini-3.1-flash-lite",
  memory: "openai/gpt-6-luna",
  memoryFallback: "google/gemini-3.5-flash-lite",
} as const

export default modelsTracker
