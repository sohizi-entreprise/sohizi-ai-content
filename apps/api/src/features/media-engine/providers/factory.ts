import { MediaConfigurationError } from '../errors'
import type { MediaEngineProvider } from './type'
import { WaveSpeedProvider } from './wave-speed'

export const WAVESPEED_VENDOR = 'wavespeed'

type MediaProviderConstructor = new (apiKey: string) => MediaEngineProvider

const PROVIDER_CLASSES: Record<string, MediaProviderConstructor> = {
  [WAVESPEED_VENDOR]: WaveSpeedProvider,
}

const API_KEY_ENV: Record<string, string> = {
  [WAVESPEED_VENDOR]: 'WAVESPEED_API_KEY',
}

function apiKeyEnvName(vendorName: string): string {
  return (
    API_KEY_ENV[vendorName] ??
    `${vendorName.toUpperCase().replace(/-/g, '_')}_API_KEY`
  )
}

export function listRegisteredMediaVendors(): string[] {
  return Object.keys(PROVIDER_CLASSES)
}

export function isRegisteredMediaVendor(name: string): boolean {
  return name in PROVIDER_CLASSES
}

export function hasProviderApiKey(name: string): boolean {
  return Boolean(process.env[apiKeyEnvName(name)])
}

export function registerMediaProvider(
  name: string,
  ProviderClass: MediaProviderConstructor,
): void {
  PROVIDER_CLASSES[name] = ProviderClass
}

export function unregisterMediaProvider(name: string): void {
  delete PROVIDER_CLASSES[name]
}

function getProviderApiKey(name: string): string {
  const apiKey = process.env[apiKeyEnvName(name)]
  if (!apiKey) {
    throw new MediaConfigurationError(`${apiKeyEnvName(name)} is not set`)
  }
  return apiKey
}

export type MediaProviderFactory = (name: string) => MediaEngineProvider

export function createProvider(name: string): MediaEngineProvider {
  const ProviderClass = PROVIDER_CLASSES[name]
  if (!ProviderClass) {
    throw new MediaConfigurationError(`Unknown media provider: ${name}`)
  }
  return new ProviderClass(getProviderApiKey(name))
}
