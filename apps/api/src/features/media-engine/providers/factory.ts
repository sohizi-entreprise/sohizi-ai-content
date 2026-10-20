import { MediaConfigurationError } from "../errors"
import type { MediaEngineProvider } from "./type"
import { WaveSpeedProvider } from "./wave-speed"

export const WAVESPEED_ADAPTER = "wavespeed"

type MediaProviderConstructor = new (apiKey: string) => MediaEngineProvider

const PROVIDER_CLASSES: Record<string, MediaProviderConstructor> = {
  [WAVESPEED_ADAPTER]: WaveSpeedProvider,
}

function apiKeyEnvName(vendorName: string): string {
  return `${vendorName.toUpperCase().replace(/-/g, "_")}_API_KEY`
}

export function listRegisteredMediaAdapters(): string[] {
  return Object.keys(PROVIDER_CLASSES)
}

export function isRegisteredMediaAdapter(name: string): boolean {
  return name in PROVIDER_CLASSES
}

export function hasProviderApiKey(vendorName: string): boolean {
  return Boolean(process.env[apiKeyEnvName(vendorName)])
}

export function registerMediaAdapter(
  name: string,
  ProviderClass: MediaProviderConstructor,
): void {
  PROVIDER_CLASSES[name] = ProviderClass
}

export function unregisterMediaAdapter(name: string): void {
  delete PROVIDER_CLASSES[name]
}

export type MediaProviderFactory = (
  adapter: string,
  apiKey: string,
) => MediaEngineProvider

export function createProvider(
  adapter: string,
  apiKey: string,
): MediaEngineProvider {
  const ProviderClass = PROVIDER_CLASSES[adapter]
  if (!ProviderClass) {
    throw new MediaConfigurationError(`Unknown media adapter: ${adapter}`)
  }
  if (!apiKey) {
    throw new MediaConfigurationError("Media API key is not set")
  }
  return new ProviderClass(apiKey)
}
